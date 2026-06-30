// Source of truth for the alert's soruce: where does the trigger come from?
// `Source` is the literal value stored in `AlertTable.input` and in `AlertModel.input`. 

export const Source = {
  Polling: "Polling Source",
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
