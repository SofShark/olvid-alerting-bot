// Source of truth for the alert's soruce: where does the trigger come from?
// `Source` is the literal value stored in `AlertTable.input` and in `AlertModel.input`. 

export const Source = {
  Polling: "Polling Source", // shown as "Data Polling" in the UI
  Monitoring: "Monitoring Source", // HTTP status watcher
  Webhook: "Webhook Source",
} as const;

export type Source = (typeof Source)[keyof typeof Source];

// ── Predicates ─────────────────────────────────────────────────────────────

/**
 * True when the alert's input is the polling source. Accepts the alert's
 * raw `input` string (callers usually pass `form.input` or `alert.input`).
 */
export const isPolling = (source: string | undefined | null): boolean =>
  source === Source.Polling;

/**
 * True when the alert's input is the monitoring source. Symmetric to
 * `isPolling`; convenient at read sites that branch by source.
 */
export const isMonitoring = (source: string | undefined | null): boolean =>
  source === Source.Monitoring;

/**
 * True when the alert's input is one of the scheduled (cron-driven)
 * sources. Both Polling and Monitoring are dispatched by the heartbeat;
 * Webhook is push-only. This predicate is the single source of truth for
 * "should the heartbeat consider this alert?".
 */
export const isScheduled = (source: string | undefined | null): boolean =>
  source === Source.Polling || source === Source.Monitoring;
