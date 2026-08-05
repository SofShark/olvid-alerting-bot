// Source of truth for the alert's source: where does the trigger come from?
// `Source` is the literal value stored in `AlertTable.input` and in
// `AlertModel.input`.
//
// Convention: read sites check the source inline with `x.input === Source.X`
// — usually inside a local `computed(() => …)`. No shared predicate
// helpers: each caller ends up with fewer imports and a self-contained
// boolean it can name however fits the surrounding logic.

export const Source = {
  Polling: "Polling Source", // shown as "Data Polling" in the UI
  Monitoring: "Monitoring Source", // HTTP status watcher
  Webhook: "Webhook Source",
} as const;

export type Source = (typeof Source)[keyof typeof Source];
