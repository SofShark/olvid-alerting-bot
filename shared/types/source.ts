// The single discriminator for an alert: where does the trigger come from?
//
// `Source` is the literal value stored in `AlertTable.input` and in
// `AlertModel.input`. It's the source of truth for the alert's kind;
// nothing else duplicates it.
//
// We declare the runtime VALUE (const) and the compile-time TYPE under
// the same name. The const lets you write `Source.Polling` in code; the
// type lets you write `: Source` as an annotation. TypeScript keeps the
// two in separate namespaces so they coexist cleanly.

export const Source = {
  Polling: 'Polling Source',
  Webhook: 'Webhook Source',
} as const

export type Source = (typeof Source)[keyof typeof Source]

// ── Predicates ─────────────────────────────────────────────────────────────

/**
 * True when the alert's input is the polling source. Accepts the alert's
 * raw `input` string (callers usually pass `form.input` or `alert.input`).
 */
export const isPolling = (source: string | undefined | null): boolean =>
  source === Source.Polling

/** Legacy alias — kept for the transition. Callers should migrate to `isPolling`. */
export const isPollingSource = isPolling
