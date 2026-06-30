// Alert + Bundle data access. PURE persistence — no business rules.
//
// What lives here:
//   - CRUD against AlertTable and its children (Bundle, LastAlertPayload, LastFailedPayload).
//   - BigInt ⇄ string serialization at the API boundary.
//   - discussion_list shape coercion (object | id | string-csv → bigint[]).
//
// What does NOT live here:
//   - "An alert can't be activated without bundles" → that's a domain rule
//     (lives in alertService.ts).
//   - "computeStatus" → domain rule, alertService.
//
// Two of the bdManager.ts methods crossed both concerns; we split them:
//   - createAlert(data)              → alertService.createAlert    (rule)
//                                     → alertRepository.create     (this file)
//   - updateAlert(id, data)          → alertService.updateAlert    (rule)
//                                     → alertRepository.update     (this file)
//   - updateStatus(id, status)       → alertService.setStatus      (rule)
//                                     → alertRepository.setStatusRaw (this file)
//
// Everything else (reads, delete, payload upserts) is pass-through —
// callers can import the repo directly when they don't need the service.

import { AlertStatus } from "#shared/types/alert";
import { Source } from "#shared/types/source";
import { prisma } from "../db/prisma";

// ── BigInt / shape helpers ────────────────────────────────────────────────

/**
 * discussion_list arrives in many shapes:
 *   - array of objects ({ id }), or
 *   - array of bare ids (string | number | bigint), or
 *   - comma-separated string.
 * Returns a clean BigInt[] for Prisma.
 */
function parseDiscussionList(list: any): bigint[] {
  if (!list) return [];

  let ids: any[];
  if (typeof list === "string") {
    ids = list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(list)) {
    ids = list.map((item) =>
      item && typeof item === "object" ? item.id : item,
    );
  } else {
    return [];
  }

  return ids
    .filter((id: any) => id !== null && id !== undefined && id !== "")
    .map((id: any) => BigInt(id));
}

function toBundleCreate(bundle: any) {
  return {
    name: bundle.name ?? null,
    discussion_list: parseDiscussionList(bundle.discussion_list),
    formating: bundle.formating ?? "Unformatted",
    custom_script: bundle.custom_script ?? null,
  };
}

// BigInt -> string on the way out (JSON-safe for the frontend).
function serializeBundle(bundle: any) {
  return {
    ...bundle,
    discussion_list: bundle.discussion_list.map((id: bigint) => id.toString()),
  };
}

function serializeAlert(alert: any) {
  return {
    ...alert,
    bundles: (alert.bundles ?? []).map(serializeBundle),
  };
}

// ── Repository ────────────────────────────────────────────────────────────

export const alertRepository = {
  // ── Reads ────────────────────────────────────────────────────────────────

  async getAll() {
    const rows = await prisma.alertTable.findMany({
      orderBy: { createdAt: "desc" },
      include: { bundles: true },
    });
    return rows.map(serializeAlert);
  },

  async getActivePolling(){
    const rows = await prisma.alertTable.findMany({
      where: {status:AlertStatus.Active, input: Source.Polling},
      include: {bundles: true}
    })
    return rows.map(serializeAlert)
  }, 

  async getById(id: number) {
    const row = await prisma.alertTable.findUnique({
      where: { id },
      include: { bundles: true },
    });
    if (!row) return null;
    return serializeAlert(row);
  },

  /** Used by the webhook endpoint. Keeps BigInt ids — the notifier
   *  converts them itself when sending to Olvid. */
  async getByToken(token: string) {
    return await prisma.alertTable.findUnique({
      where: { token },
      include: { bundles: true },
    });
  },

  // ── Mutations (bare — no domain rules) ──────────────────────────────────

  async create(data: {
    title: string;
    description?: string | null;
    input: string;
    status: AlertStatus;
    alertParams?: any;
    bundles?: any[];
  }) {
    const incomingBundles: any[] = Array.isArray(data.bundles)
      ? data.bundles
      : [];
    const created = await prisma.alertTable.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input,
        alertParams: data.alertParams ?? null,
        status: data.status,
        bundles: { create: incomingBundles.map(toBundleCreate) },
      },
      include: { bundles: true },
    });
    return serializeAlert(created);
  },

  /** Full overwrite — deletes existing bundles, recreates from `data.bundles`. */
  async update(
    id: number,
    data: {
      title: string;
      description?: string | null;
      input: string;
      status: AlertStatus;
      alertParams?: any;
      bundles?: any[];
    },
  ) {
    const incomingBundles: any[] = Array.isArray(data.bundles)
      ? data.bundles
      : [];

    await prisma.bundle.deleteMany({ where: { alertId: id } });

    const updated = await prisma.alertTable.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input,
        alertParams: data.alertParams ?? null,
        status: data.status,
        bundles: { create: incomingBundles.map(toBundleCreate) },
      },
      include: { bundles: true },
    });
    return serializeAlert(updated);
  },

  /** Status-only update. No activation rules — caller has already decided. */
  async setStatusRaw(id: number, status: AlertStatus) {
    const updated = await prisma.alertTable.update({
      where: { id },
      data: { status },
      include: { bundles: true },
    });
    return serializeAlert(updated);
  },

  async delete(id: number) {
    return await prisma.alertTable.delete({ where: { id } });
  },

  /** Persist runtime polling state (_lastSeenId, _lastHash, _baseline, …) without
   *  touching anything else. Used by the polling engine, not by the user. */
  async updateAlertParams(id: number, params: Record<string, any>) {
    await prisma.alertTable.update({
      where: { id },
      data: { alertParams: params },
    });
  },

  // ── Last-payload sidecar tables ─────────────────────────────────────────
  // Keyed by alertId. FK has onDelete: Cascade so deleting the alert cleans up.

  async upsertLastAlertPayload(alertId: number, payload: any) {
    await prisma.lastAlertPayload.upsert({
      where: { alertId },
      create: { alertId, payload },
      update: { payload },
    });
  },

  async getLastAlertPayload(alertId: number) {
    const row = await prisma.lastAlertPayload.findUnique({
      where: { alertId },
      select: { payload: true, receivedAt: true },
    });
    return row ?? null;
  },

  /** Failures are tracked separately so a subsequent success doesn't erase
   *  the diagnostic trail. `null`-able fields are allowed (e.g. the response
   *  never arrived, so no raw text). */
  async upsertLastFailedPayload(
    alertId: number,
    info: { raw?: string | null; parsed?: any; error: string; stage?: string },
  ) {
    const data = {
      raw: info.raw ?? null,
      parsed: info.parsed ?? null,
      error: info.error,
      stage: info.stage ?? null,
    };
    await prisma.lastFailedPayload.upsert({
      where: { alertId },
      create: { alertId, ...data },
      update: data,
    });
  },

  async getLastFailedPayload(alertId: number) {
    const row = await prisma.lastFailedPayload.findUnique({
      where: { alertId },
      select: {
        raw: true,
        parsed: true,
        error: true,
        stage: true,
        failedAt: true,
      },
    });
    return row ?? null;
  },
};
