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
// - draft     : input or trigger missing
// - active    : complete, has >=1 bundle and caller asked for active
// - inactive  : complete but not active (or no bundles)
function computeStatus(input: any, triggerType: any, bundleCount: number, wantActive: boolean): AlertStatus {
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
    const aStatus = computeStatus(data.input, data.triggerType, incomingBundles.length, wantActive)

    const newAlert = await prisma.alertTable.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input ?? null,
        triggerType: data.triggerType ?? null,
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
    const status = computeStatus(data.input, data.triggerType, incomingBundles.length, wantActive)

    // Replace the bundle set entirely (simplest correct strategy).
    await prisma.bundle.deleteMany({ where: { alertId: id } })

    const updated = await prisma.alertTable.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input ?? null,
        triggerType: data.triggerType ?? null,
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

  // 7. Upsert the last successful payload for a source (one row per source).
  async upsertLastPayload(source: string, payload: any) {
    await prisma.lastSourcePayload.upsert({
      where:  { source },
      create: { source, payload },
      update: { payload },
    })
  },

  // 8. Retrieve the last successful payload for a source, or null if none yet.
  async getLastPayloadForSource(source: string) {
    const row = await prisma.lastSourcePayload.findUnique({
      where: { source },
      select: { payload: true },
    })
    return row?.payload ?? null
  },
}
