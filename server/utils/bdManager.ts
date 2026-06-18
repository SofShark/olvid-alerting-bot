import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { AlertStatus, BundleModel } from '#shared/constants'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL as string
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })


// ---- Helpers -------------------------------------------------------------

// Accepts a discussion_list as an array of objects ({ id }), an array of
// ids (string/number/bigint) or a comma-separated string, and returns BigInt[].
function parseDiscussionList(list: any): bigint[] {
  if (!list) return []

  let ids: any[]
  if (typeof list === 'string') {
    ids = list.split(',').map(s => s.trim()).filter(Boolean)
  } else if (Array.isArray(list)) {
    ids = list.map(item => (item && typeof item === 'object' ? item.id : item))
  } else {
    return []
  }

  return ids
    .filter((id: any) => id !== null && id !== undefined && id !== '')
    .map((id: any) => BigInt(id))
}

// Turn an incoming bundle (from the frontend) into Prisma create data.
function toBundleCreate(bundle: any) {
  return {
    name: bundle.name ?? null,
    discussion_list: parseDiscussionList(bundle.discussion_list),
    formating: bundle.formating ?? 'Unformatted',
    custom_script: bundle.custom_script ?? null,
  }
}

// BigInt -> string for the frontend (JSON-safe).
function serializeBundle(bundle: any) {
  return {
    ...bundle,
    discussion_list: bundle.discussion_list.map((id: bigint) => id.toString()),
  }
}

function serializeAlert(alert: any) {
  return {
    ...alert,
    bundles: (alert.bundles ?? []).map(serializeBundle),
  }
}

// Rules:
// - draft     : explicit client request OR input/trigger missing
// - active    : complete, has >=1 bundle and caller asked for active
// - inactive  : complete but not active (or no bundles)
function computeStatus(input: any, triggerType: any, bundleCount: number, wantActive: boolean, wantDraft: boolean): AlertStatus {
  if (wantDraft) return AlertStatus.Draft
  if (!input || !triggerType) return AlertStatus.Draft
  if (wantActive && bundleCount > 0) return AlertStatus.Active
  return AlertStatus.Inactive
}


// Data Base Manager serving all the operations related to alerts/bundles.
export const bdManager = {

  // 1. All alerts (newest first) with their bundles, discussion ids as strings.
  async getAllAlerts() {
    const alertas = await prisma.alertTable.findMany({
      orderBy: { createdAt: 'desc' },
      include: { bundles: true },
    })
    return alertas.map(serializeAlert)
  },

  // 2. CREATE — alert + nested bundles in one operation.
  async createAlert(data: any) {
    const incomingBundles: any[] = Array.isArray(data.bundles) ? data.bundles : []
    const wantActive = data.status === AlertStatus.Active
    const wantDraft  = data.status === AlertStatus.Draft
    const aStatus = computeStatus(data.input, data.triggerType, incomingBundles.length, wantActive, wantDraft)

    const newAlert = await prisma.alertTable.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input ?? null,
        triggerType: data.triggerType ?? null,
        triggerParams: data.triggerParams ?? null,
        status: aStatus,
        bundles: {
          create: incomingBundles.map(toBundleCreate),
        },
      },
      include: { bundles: true },
    })

    return serializeAlert(newAlert)
  },

  // 3. UPDATE — scalar fields + replace bundles (delete then recreate).
  async updateAlert(id: number, data: any) {
    const incomingBundles: any[] = Array.isArray(data.bundles) ? data.bundles : []
    const wantActive = data.status === AlertStatus.Active
    const wantDraft  = data.status === AlertStatus.Draft
    const status = computeStatus(data.input, data.triggerType, incomingBundles.length, wantActive, wantDraft)

    // Replace the bundle set entirely (simplest correct strategy).
    await prisma.bundle.deleteMany({ where: { alertId: id } })

    const updated = await prisma.alertTable.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input ?? null,
        triggerType: data.triggerType ?? null,
        triggerParams: data.triggerParams ?? null,
        status,
        bundles: {
          create: incomingBundles.map(toBundleCreate),
        },
      },
      include: { bundles: true },
    })

    return serializeAlert(updated)
  },

  // 3b. STATUS toggle only (active <-> inactive). Won't activate without bundles.
  async updateStatus(id: number, status: string) {
    const alert = await prisma.alertTable.findUnique({
      where: { id },
      include: { bundles: true },
    })
    if (!alert) return null

    let finalStatus = status
    if (status === AlertStatus.Active && alert.bundles.length === 0) {
      finalStatus = AlertStatus.Inactive // can't activate without a bundle
    }

    const updated = await prisma.alertTable.update({
      where: { id },
      data: { status: finalStatus },
      include: { bundles: true },
    })
    return serializeAlert(updated)
  },

  // 4. DELETE — cascades bundles + logs.
  async deleteAlert(id: number) {
    return await prisma.alertTable.delete({ where: { id } })
  },

  // 5. GET by id.
  async getAlertById(id: number) {
    const alerta = await prisma.alertTable.findUnique({
      where: { id },
      include: { bundles: true },
    })
    if (!alerta) return null
    return serializeAlert(alerta)
  },

  // 6. GET by webhook token (used by the webhook endpoint). Keeps BigInt ids:
  //    the alert manager converts them itself.
  async getAlertByToken(token: string) {
    return await prisma.alertTable.findUnique({
      where: { token },
      include: { bundles: true },
    })
  },

  // 7. Persist updated triggerParams (e.g. _lastSeenId, _lastHash) without touching other fields.
  async updateTriggerParams(id: number, params: Record<string, any>) {
    await prisma.alertTable.update({
      where: { id },
      data: { triggerParams: params },
    })
  },

  // 8. Upsert the last successful payload for an alert. Keyed by alertId so
  // each alert has its own row (webhook body, or polling parse-result). The
  // FK is set up with onDelete: Cascade — deleting the alert removes the
  // payload row automatically.
  async upsertLastAlertPayload(alertId: number, payload: any) {
    await prisma.lastAlertPayload.upsert({
      where:  { alertId },
      create: { alertId, payload },
      update: { payload },
    })
  },

  // 8. Retrieve the last successful payload for a given alert, or null if
  // we've never received/polled anything for it yet.
  async getLastAlertPayload(alertId: number) {
    const row = await prisma.lastAlertPayload.findUnique({
      where:  { alertId },
      select: { payload: true, receivedAt: true },
    })
    return row ?? null
  },

  // 9. Upsert the most recent FAILURE for an alert (admin debugging). This
  // is intentionally independent of `lastAlertPayload` — a later success
  // does not clear the row, so the diagnostic trail survives recoveries.
  // `null`-ing fields is allowed when we don't have them (e.g. the response
  // never arrived, so no raw text).
  async upsertLastFailedPayload(
    alertId: number,
    info: { raw?: string | null; parsed?: any; error: string; stage?: string },
  ) {
    const data = {
      raw:    info.raw ?? null,
      parsed: info.parsed ?? null,
      error:  info.error,
      stage:  info.stage ?? null,
    }
    await prisma.lastFailedPayload.upsert({
      where:  { alertId },
      create: { alertId, ...data },
      update: data,
    })
  },

  // 9. Retrieve the most recent failure for an alert, or null if none on
  // record.
  async getLastFailedPayload(alertId: number) {
    const row = await prisma.lastFailedPayload.findUnique({
      where:  { alertId },
      select: { raw: true, parsed: true, error: true, stage: true, failedAt: true },
    })
    return row ?? null
  },
}
