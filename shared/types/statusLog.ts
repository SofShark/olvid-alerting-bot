// Defines One row of the AlertLog table. Every poll (successful or failed) inserts
// one row; only the non-success rows carry an `error` message. The polling
// heartbeat is the primary writer today; webhook handlers can insert too
// once we decide the semantics for them.
//
// Kept lean on purpose: no stage/context object, no duration, no payload
// snapshot. The alert's LastAlertPayload / LastFailedPayload tables already
// carry the diagnostic detail — this table is for the timeline / chart,
// not for forensics.

export const LogStatus = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;
export type LogStatus = (typeof LogStatus)[keyof typeof LogStatus];

export type AlertLog = {
  id: number;
  alertId: number;
  status: LogStatus;
  /** Human-readable failure message. Populated only when status !== Success. */
  error: string | null;
  createdAt: string;
};
