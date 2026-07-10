// Alert + Bundle data access. PURE persistence — no business rules.
//
// What lives here:
//   - CRUD against AlertTable and its children (Bundle, BundleOutput,
//     LastAlertPayload, LastFailedPayload).
//   - BigInt ⇄ string serialization at the API boundary (Olvid discussion
//     IDs live as bigint inside BundleOutput.params, but the wire wants
//     strings — JSON.stringify can't handle bigint).
//   - BundleOutput shape coercion at write time.
//
// What does NOT live here:
//   - "An alert can't be activated without bundles" → alertService.
//   - dispatch-by-output.type → notifierService.

import { AlertStatus } from "#shared/types/alert";
import { Source } from "#shared/types/source";
import { prisma } from "#server/db/prisma"
import { BundleModel } from "~~/shared/types/bundle";
import {
  BundleOutputType,
  type BundleFrontendOutput,
} from "~~/shared/types/bundleOutput";

// ── BundleOutput shape helpers ────────────────────────────────────────────

/**
 * Turn what the frontend sends into rows ready for Prisma nested-write.
 *
 * The frontend today edits Olvid discussions as `{ type: "olvid",
 * params: { discussionId: "12345" } }` — bare string. We normalise:
 *   - dropping empty/null discussionIds,
 *   - stringifying the id (defensive; must be safe for JSON storage),
 *   - stamping the type verbatim (only "olvid" is honored today; future
 *     variants can be added without touching this function).
 *
 * The DB stores params as JSON, with `discussionId` as a STRING (not
 * bigint) so it JSON-serializes losslessly. The notifier does `BigInt(id)`
 * at the point where it needs to call the Olvid client.
 */
function buildOutputsCreate(outputs: any): Array<{ type: string; params: any }> {
  if (!Array.isArray(outputs)) return [];
  return outputs
    .filter((o) => o && typeof o === "object" && o.type)
    .map((o) => {
      if (o.type === BundleOutputType.Olvid) {
        const raw = o.params?.discussionId;
        if (raw === null || raw === undefined || raw === "") return null;
        return { type: BundleOutputType.Olvid, params: { discussionId: String(raw) } };
      }
      // Unknown type — pass through opaquely; future channels can slot in
      // without a code change here as long as their params are JSON-safe.
      return { type: o.type, params: o.params ?? {} };
    })
    .filter((o): o is { type: string; params: any } => o !== null);
}

function toBundleCreate(bundle: any) {
  return {
    name: bundle.name ?? null,
    formating: bundle.formating ?? "Unformatted",
    custom_script: bundle.custom_script ?? null,
    outputs: {
      create: buildOutputsCreate(bundle.outputs),
    },
  };
}

// Prisma → wire. Each BundleOutput row becomes a BundleFrontendOutput with
// JSON-safe params. Server-side bigints (if any) never cross this boundary.
function serializeOutput(output: any): BundleFrontendOutput {
  if (output.type === BundleOutputType.Olvid) {
    // discussionId is already stored as a JSON string; passthrough.
    const discussionId = String(output.params?.discussionId ?? "");
    return { type: BundleOutputType.Olvid, params: { discussionId } };
  }
  // Unknown / future types — best-effort passthrough.
  return { type: output.type, params: output.params ?? {} };
}

function serializeBundle(bundle: any) {
  const { outputs, ...rest } = bundle;
  return {
    ...rest,
    outputs: (outputs ?? []).map(serializeOutput),
  };
}

function serializeAlert(alert: any) {
  return {
    ...alert,
    bundles: (alert.bundles ?? []).map(serializeBundle),
  };
}

// Every alert read must fetch bundles + their outputs — the outputs are the
// destination list, so a bundle without them is unusable.
const ALERT_INCLUDE = {
  bundles: { include: { outputs: true } },
} as const;

// ── Repository ────────────────────────────────────────────────────────────

export const alertRepository = {
  // ── Reads ────────────────────────────────────────────────────────────────

  async getAll() {
    const rows = await prisma.alertTable.findMany({
      orderBy: { createdAt: "desc" },
      include: ALERT_INCLUDE,
    });
    return rows.map(serializeAlert);
  },

  /**
   * All active alerts whose input drives a scheduled probe (Polling or
   * Monitoring). Webhook alerts are excluded — they're push-driven and
   * the heartbeat has no work to do for them.
   */
  async getActiveScheduled() {
    const rows = await prisma.alertTable.findMany({
      where: {
        status: AlertStatus.Active,
        input: { in: [Source.Polling, Source.Monitoring] },
      },
      include: ALERT_INCLUDE,
    });
    return rows.map(serializeAlert);
  },

  async getById(id: number) {
    const row = await prisma.alertTable.findUnique({
      where: { id },
      include: ALERT_INCLUDE,
    });
    if (!row) return null;
    return serializeAlert(row);
  },

  /** Used by the webhook endpoint. Serialized like every other read now
   *  that BundleOutput.params.discussionId is already stored as a string. */
  async getByToken(token: string) {
    const row = await prisma.alertTable.findUnique({
      where: { token },
      include: ALERT_INCLUDE,
    });
    return row ? serializeAlert(row) : null;
  },

  // ── Mutations (bare — no domain rules) ──────────────────────────────────

  async create(data: {
    title: string;
    description?: string | null;
    input: Source;
    status: AlertStatus;
    alertParams?: any;
    bundles?: BundleModel[];
  }) {
    const incomingBundles: any[] = Array.isArray(data.bundles) ? data.bundles : [];
    const created = await prisma.alertTable.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        input: data.input,
        alertParams: data.alertParams ?? null,
        status: data.status,
        bundles: { create: incomingBundles.map(toBundleCreate) },
      },
      include: ALERT_INCLUDE,
    });
    return serializeAlert(created);
  },

  /** Full overwrite — deletes existing bundles (and their outputs via
   *  cascade), recreates from `data.bundles`. */
  async update(
    id: number,
    data: {
      title: string;
      description?: string | null;
      input: Source;
      status: AlertStatus;
      alertParams?: any;
      bundles?: any[];
    },
  ) {
    const incomingBundles: any[] = Array.isArray(data.bundles) ? data.bundles : [];

    // Cascade FK on BundleOutput.bundleId cleans up outputs automatically.
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
      include: ALERT_INCLUDE,
    });
    return serializeAlert(updated);
  },

  /** Status-only update. No activation rules — caller has already decided. */
  async setStatusRaw(id: number, status: AlertStatus) {
    const updated = await prisma.alertTable.update({
      where: { id },
      data: { status },
      include: ALERT_INCLUDE,
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

  //TODO:  MOVE TO SPECIALISED REPOSITORY : alertPayloadRepository.ts

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
