// AlertLog persistence — one row per poll event (success / warning / error).
//
// Only two callers today:
//   - server/tasks/polling/heartbeat.ts — the primary writer, inserts on
//     every pollOne outcome.
//   - server/api/alerts/[id]/logs.ts   — reader for the AlertLogs panel.
//
// The 200-row cap per alertId is enforced right here on insert so it can
// never drift out of shape: the row is created, then anything past the
// cap is deleted in the same request. Fine at our scale (≤ 20 active
// polling alerts × 1-minute cadence = ~1200 inserts/hour worst case).

import {
  LogStatus,
  type LogStatus as LogStatusT,
} from "#shared/types/statusLog";
import { prisma } from "../db/prisma";

/** Hard cap per alertId. See the schema comment for rationale. */
const MAX_LOGS_PER_ALERT = 200;

/** Prisma → wire shape. Coerces the Date to an ISO string so the client
 *  can consume it without dealing with Date instances. */
function serialize(row: {
  id: number;
  alertId: number;
  status: string;
  error: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    alertId: row.alertId,
    status: row.status as LogStatusT,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export const alertLogRepository = {
  /**
   * Append a log row for an alert. Success rows leave `error` null; warning
   * and error rows carry a short human-readable message. After insert, any
   * rows past the 200 cap for this alert are pruned (oldest first).
   */
  async insert(
    alertId: number,
    status: LogStatusT,
    error: string | null = null,
  ) {
    const inserted = await prisma.alertLog.create({
      data: { alertId, status, error },
    });

    // Cap enforcement — count and prune only when we're about to overflow.
    const total = await prisma.alertLog.count({ where: { alertId } });
    if (total > MAX_LOGS_PER_ALERT) {
      const overflow = total - MAX_LOGS_PER_ALERT;
      const oldest = await prisma.alertLog.findMany({
        where: { alertId },
        orderBy: { createdAt: "asc" },
        take: overflow,
        select: { id: true },
      });
      await prisma.alertLog.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
    }

    return serialize(inserted);
  },

  /**
   * Latest first, capped at `limit` (defaults to the 200-row hard cap so
   * the caller doesn't have to remember it). Powers the right-side logs
   * panel in AlertView.
   */
  async getForAlert(alertId: number, limit: number = MAX_LOGS_PER_ALERT) {
    const rows = await prisma.alertLog.findMany({
      where: { alertId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(serialize);
  },

  /** Convenience shortcuts so callers don't have to import LogStatus. */
  logSuccess: (alertId: number) =>
    alertLogRepository.insert(alertId, LogStatus.Success, null),
  logWarning: (alertId: number, error: string) =>
    alertLogRepository.insert(alertId, LogStatus.Warning, error),
  logError: (alertId: number, error: string) =>
    alertLogRepository.insert(alertId, LogStatus.Error, error),
};
