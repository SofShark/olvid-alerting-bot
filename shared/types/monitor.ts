// Monitoring-specific alert configuration. Stored as the JSON `alertParams`
// column on AlertTable when `input === Source.Monitoring`.
//
// Semantically parallel to PollingParams (same cron cadence, same trigger
// mode, same bundles + notifier + log pipeline), but the "condition" is
// a match on the HTTP response STATUS CODE rather than a rule over a
// parsed body. There is no `format` field — no body parsing happens.
//
// `_`-prefixed keys are runtime state managed by the dispatcher (last
// observed status, last-fired flag for edge detection, last-poll
// timestamp). They survive serialization but the UI ignores them.

import type { TriggerMode } from "./polling";

/** How a probed HTTP status is matched against the alert's rule.
 *
 *  - codes:  fires when the response status is IN the list (e.g. [404, 500]).
 *  - range:  fires when the status falls in a class (2xx, 3xx, 4xx, 5xx).
 *  - not-ok: fires whenever the status is NOT in 200-299. Common shortcut
 *            for "the endpoint is down or broken". */
export type StatusMatch =
  | { kind: "codes"; codes: number[] }
  | { kind: "range"; range: HttpRange }
  | { kind: "not-ok" };

export type HttpRange = "2xx" | "3xx" | "4xx" | "5xx";

export type MonitorParams = {
  /** Endpoint to sonde. */
  url: string;
  /** Cron expression describing the check cadence — same shape and helper
   *  (`shared/polling/scheduler.ts`) as Polling. */
  schedule: string;
  /** What triggers the alert given the observed status. */
  match: StatusMatch;
  /** When the alert should re-fire (EveryTime / OneShot / WithRecovery).
   *  Reuses the exact enum from polling.ts. */
  triggerMode?: TriggerMode;

  // Runtime engine state — not user-edited ─────────────────────────────
  /** Was the match satisfied on the last poll? Needed by firePolicy for
   *  OneShot / WithRecovery edge detection. */
  _lastFired?: boolean;
  /** Status code observed on the last completed probe. Useful for
   *  debugging + future "status changed" style rules. */
  _lastStatus?: number;
  /** Epoch ms of the last completed probe attempt (success or failure). */
  _lastPolledAt?: number;
};
