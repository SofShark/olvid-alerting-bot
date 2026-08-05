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
import type { TriggerMode } from "./triggerMode";

export const PollingFormat = {
  XML: "XML",
  JSON: "JSON",
  HTML: "HTML",
} as const;
export type PollingFormat = (typeof PollingFormat)[keyof typeof PollingFormat];

export type PollingParams = {
  url: string;
  format: PollingFormat;

  //Cron expression describing the polling cadence.
  schedule: string;
  condition: PollingCondition;
  // When the alert should re-fire. default = EveryTime
  triggerMode?: TriggerMode;

  // Runtime engine state — not user-edited ─────────────────────────────
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
