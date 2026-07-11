// BundleOutput data access — the innermost repository of the alert
// aggregate. One row per delivery target (today: one Olvid discussion;
// future: one email address, one Slack webhook, …).
//
// Boundary rules:
//   · Writes accept a Prisma transaction client so alert+bundle+output
//     creation stays atomic when the parent repository composes them.
//   · Reads (getOutputsForAlert) go through the ambient prisma client;
//     they're used for lookups outside the write path.
//   · Owns the BigInt / JSON coercion for `params.discussionId` — the
//     wire has strings, the DB stores strings (via JSON), and the
//     notifier does BigInt() when it needs to call the Olvid client.

import { Prisma } from "@prisma/client";
import { prisma } from "#server/db/prisma";
import {
  BundleOutputType,
  type BundleFrontendOutput,
} from "~~/shared/types/bundleOutput";

/** Any interactive-transaction client (or the top-level prisma). Both
 *  expose the same query surface — the split just lets us thread
 *  atomicity through nested writes. */
export type PrismaTx = Prisma.TransactionClient | typeof prisma;

// ── Shape helpers ────────────────────────────────────────────────────────

/**
 * Turn what the frontend sends into rows ready for `createMany`.
 * Normalises: drops empty/null discussionIds, stringifies the id
 * (defensive; JSON columns can't hold bigint), and only whitelists known
 * `type` values. Unknown types pass through opaquely so future channels
 * slot in without a code change here.
 */
export function buildOutputsCreate(
  outputs: unknown,
): Array<{ type: string; params: any }> {
  if (!Array.isArray(outputs)) return [];
  const rows: Array<{ type: string; params: any }> = [];
  for (const o of outputs) {
    if (!o || typeof o !== "object" || !("type" in o)) continue;
    const type = String((o as any).type);
    if (type === BundleOutputType.Olvid) {
      const raw = (o as any).params?.discussionId;
      if (raw === null || raw === undefined || raw === "") continue;
      rows.push({ type: BundleOutputType.Olvid, params: { discussionId: String(raw) } });
    } else {
      // Passthrough for future channels — the caller is responsible
      // for the params shape until we add a validator here.
      rows.push({ type, params: (o as any).params ?? {} });
    }
  }
  return rows;
}

/** DB row → wire shape. `discussionId` stays a string on both sides. */
export function serializeOutput(output: any): BundleFrontendOutput {
  if (output.type === BundleOutputType.Olvid) {
    const discussionId = String(output.params?.discussionId ?? "");
    return { type: BundleOutputType.Olvid, params: { discussionId } };
  }
  return { type: output.type, params: output.params ?? {} };
}

// ── Repository ────────────────────────────────────────────────────────────

export const alertOutputRepository = {
  /**
   * Create all outputs for a given bundle in one round-trip. Skips
   * silently if the input is empty — a bundle with no outputs is
   * flagged by useBundleStatus, not this repo.
   */
  async createForBundle(
    tx: PrismaTx,
    bundleId: number,
    outputs: unknown,
  ): Promise<void> {
    const rows = buildOutputsCreate(outputs).map((row) => ({ ...row, bundleId }));
    if (rows.length === 0) return;
    await tx.bundleOutput.createMany({ data: rows });
  },

  /**
   * All outputs of every bundle belonging to a given alert. Flat
   * list — the caller decides how to group. Used outside the write
   * path (e.g. reports, exports) so it goes through the ambient client.
   */
  async getOutputsForAlert(alertId: number) {
    return await prisma.bundleOutput.findMany({
      where: { bundle: { alertId } },
    });
  },
};
