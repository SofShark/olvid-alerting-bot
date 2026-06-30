// Polling-specific alert configuration. Stored as the JSON `alertParams`
// column on AlertTable, but ONLY for alerts whose Source is Polling.
// Webhook alerts carry no params at all — `alertParams` is `undefined`
// for them, not an empty object.
//
// `_`-prefixed keys are runtime state managed by the polling engine
// (baseline snapshot, last-fetched hash, last-fired flag for edge
// detection, last-poll timestamp). They survive serialization but the
// UI ignores them.

import type { PollingCondition } from "./condition";

export const PollingFormat = {
  XML: "XML",
  JSON: "JSON",
  HTML: "HTML",
} as const;
export type PollingFormat = (typeof PollingFormat)[keyof typeof PollingFormat];

// How often the alert is allowed to fire when its condition is satisfied:
//
//   EveryTime    fire on every poll while the condition is true (default —
//                same behaviour the engine has always had).
//
//   OneShot      fire only when the condition transitions false → true.
//                Stays quiet on subsequent polls while still true.
//                Useful for "the server is down" alerts: notify once,
//                not every 5 minutes.
//
//   WithRecovery same as OneShot plus a "recovery" message when the
//                condition transitions back true → false. The notifier
//                prefixes the message with "✓ RECOVERED:" so existing
//                bundle scripts don't need to know about this mode.
//
// Trigger mode is IGNORED when the condition is kind=None (every-poll alert
// by design) or operator=Changed (each change is itself a discrete event).
export const TriggerMode = {
  EveryTime: "every-time",
  OneShot: "one-shot",
  WithRecovery: "with-recovery",
} as const;
export type TriggerMode = (typeof TriggerMode)[keyof typeof TriggerMode];

export type PollingParams = {
  url: string;
  format: PollingFormat;
  /**
   * Cron expression describing the polling cadence. Replaces the old
   * `intervalSeconds` + `dailyAt` pair — one field, one source of truth.
   * The wizard serialises its friendly minute / hour / daily controls
   * through `scheduler.modeToCron` (see shared/polling/scheduler.ts).
   */
  schedule: string;
  condition: PollingCondition;
  /** When the alert should re-fire. Absent = EveryTime (back-compat default). */
  triggerMode?: TriggerMode;

  // ── Runtime engine state — not user-edited ─────────────────────────────
  _lastHash?: string;
  _baseline?: unknown;
  /**
   * Was the condition true on the last poll? Required for OneShot /
   * WithRecovery edge detection. The engine writes this after every poll.
   */
  _lastFired?: boolean;
  /** Epoch ms of the last completed poll attempt (success or failure). */
  _lastPolledAt?: number;
};
