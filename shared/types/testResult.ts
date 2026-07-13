// One envelope for "run this alert once without side effects" — both
// Polling and Monitoring sources return this shape, and the UI reads
// only this shape. Adding a new source means writing a new tester that
// produces `AlertTestResult`; the endpoint and the UI don't change.
//
// `parsed` is intentionally `unknown` at the type level: polling ships
// the parser output tree, monitoring ships a MonitorProbePayload. The
// UI treats it as an opaque debug blob (rendered via JSON.stringify).

/** One row of the optional per-field breakdown surfaced under the
 *  verdict card. Only polling produces this today; monitoring leaves
 *  it undefined and the UI hides the section. */
export type ConditionFieldBreakdown = {
  path: string;
  fired: boolean;
  detail: string;
};

/** The verdict half of the envelope — did this run "fire", why. */
export type ConditionOutcome = {
  fired: boolean;
  reason?: string | null;
  /** Optional per-field expansion. Monitoring omits it. */
  baselineValue?: ConditionFieldBreakdown[];
};

/** One bundle's rendered message + metadata for the "messages per
 *  bundle" section of the result modal. */
export type BundleMessageResult = {
  index: number;
  bundleId: number | null;
  formating: string;
  discussionCount: number;
  /** Empty string when `error` is set. */
  message: string;
  /** Handlebars / formatter failure isolated to this bundle. */
  error: string | null;
};

export type AlertTestResult = {
  /** False when the whole test path failed before evaluating a
   *  condition (bad URL, no params, network error, …). `error` is set
   *  in that case and the rest of the envelope may be partial. */
  ok: boolean;
  error?: string | null;
  /** Debug: the raw parsed source / probe payload. Renderer treats it
   *  as opaque JSON. */
  parsed?: unknown;
  condition?: ConditionOutcome;
  bundleMessages: BundleMessageResult[];
};
