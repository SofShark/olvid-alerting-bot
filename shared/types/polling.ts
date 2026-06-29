// Polling-specific alert configuration. Stored as the JSON `alertParams`
// column on AlertTable, but ONLY for alerts whose Source is Polling.
// Webhook alerts carry no params at all — `alertParams` is `undefined`
// for them, not an empty object.
//
// `_`-prefixed keys are runtime state managed by the polling engine
// (baseline snapshot, last-fetched hash). They survive serialization
// but the UI ignores them.

import type { PollingCondition } from "./condition";

export const PollingFormat = {
  XML: "XML",
  JSON: "JSON",
  HTML: "HTML",
} as const;
export type PollingFormat = (typeof PollingFormat)[keyof typeof PollingFormat];

export type PollingParams = {
  url: string;
  format: PollingFormat;
  intervalSeconds: number;
  dailyAt?: string;
  condition: PollingCondition;

  // Runtime engine state — not user-edited.
  _lastHash?: string;
  _baseline?: unknown;
};
