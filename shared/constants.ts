// Single-axis taxonomy: every alert is either a polling or a webhook alert,
// captured by `Source`. The DB column `AlertTable.input` stores the Source
// value verbatim — that single field is the source of truth. `alertParams`
// carries only TYPE-SPECIFIC config (URL/format/interval/condition for
// polling; empty for webhook) — it does NOT duplicate `source`.

export enum Source {
  Webhook = 'Webhook Source',
  Polling = 'Polling Source',
}

export enum PollingFormat {
  XML  = 'XML',
  JSON = 'JSON',
  HTML = 'HTML',
}

export enum ConditionKind {
  None = 'none',
  Rule = 'rule',
}

export enum ConditionOperator {
  Changed     = 'changed',        // value differs from previous poll's snapshot
  Equals      = 'equals',         // value === literal
  GreaterThan = 'greater_than',   // numeric comparison
  LessThan    = 'less_than',
  Contains    = 'contains',       // substring match on string value
}

// How to combine the per-path verdicts when a rule watches more than one path.
export enum ConditionAggregation {
  All = 'all',   // every path must verify   (logical AND)
  Any = 'any',   // at least one path        (logical OR)
}

// Operators that need a literal value to compare against. `Changed` doesn't —
// it's always compared to the previous poll's snapshot.
export const OPERATORS_NEEDING_VALUE: ReadonlySet<ConditionOperator> = new Set([
  ConditionOperator.Equals,
  ConditionOperator.GreaterThan,
  ConditionOperator.LessThan,
  ConditionOperator.Contains,
])

export enum Formatting {
  // Webhook-oriented options — work on the raw posted payload.
  Unformatted    = 'Unformatted',
  Simple         = 'Simple',
  Custom         = 'Custom',
  // Polling-oriented options — work on the parsed source + the alert's condition.
  PollingDefault = 'PollingDefault',
  PollingCustom  = 'PollingCustom',
}

// Default formats expected for each trigger family.
export const DEFAULT_FORMAT_FOR_POLLING = Formatting.PollingDefault
export const DEFAULT_FORMAT_FOR_WEBHOOK = Formatting.Unformatted

export enum AlertStatus {
  Draft    = 'draft',
  Inactive = 'inactive',
  Active   = 'active',
}

// True when the alert's `input` is the polling Source. Takes the alert's
// source string directly — no AlertType layer to normalise through.
export const isPolling = (source: string | undefined | null): boolean =>
  source === Source.Polling

// Same predicate under the older name. Existing call sites pass the alert's
// `input` string; both names resolve to the same check.
export const isPollingSource = isPolling

// ── TriggerParams shapes ────────────────────────────────────────────────────
// Stored as JSON in AlertTable.alertParams.
// _-prefixed keys are runtime state managed by the polling engine.

// Condition that decides whether a poll cycle actually fires the alert.
export type PollingCondition = {
  kind:        ConditionKind
  paths:       string[]                // dot-paths or wildcard patterns
  operator:    ConditionOperator       // unused (but preserved) when kind === None
  value?:      string                  // unused for `changed` and for kind === None
  aggregation: ConditionAggregation    // unused (but preserved) when kind === None
}

// Defaults used whenever we need a fresh-but-valid PollingCondition.
const blankCondition = (): PollingCondition => ({
  kind:        ConditionKind.None,
  paths:       [],
  operator:    ConditionOperator.Changed,
  aggregation: ConditionAggregation.All,
})

// Normalize whatever shape comes from props / DB / older drafts into the new
// homogeneous form. Legacy `{ kind: 'field_changed', field: 'x' }` is also
// upgraded here. Missing fields are filled with defaults; unknown `kind`
// values fall back to None.
export function migrateCondition(c: any): PollingCondition {
  const out = blankCondition()
  if (!c || typeof c !== 'object') return out

  // Legacy: { kind: 'field_changed', field: 'x.y.z' } → single-path Rule.
  if (c.kind === 'field_changed' && typeof c.field === 'string') {
    return {
      kind:        ConditionKind.Rule,
      paths:       c.field ? [c.field] : [],
      operator:    ConditionOperator.Changed,
      aggregation: ConditionAggregation.All,
    }
  }

  out.kind = (c.kind === ConditionKind.Rule || c.kind === ConditionKind.None)
    ? c.kind
    : ConditionKind.None
  if (Array.isArray(c.paths)) out.paths = c.paths.filter(Boolean)
  if (c.operator)             out.operator = c.operator as ConditionOperator
  if (typeof c.value === 'string') out.value = c.value
  if (c.aggregation)          out.aggregation = c.aggregation as ConditionAggregation

  return out
}

// Serialize for DB storage / API payload. When kind === None we drop the
// other fields (they're meaningless without a rule) to save bytes. When
// operator doesn't need a value, drop it too. Anything still attached after
// this function is meaningful.
export function compactCondition(c: PollingCondition): any {
  if (c.kind === ConditionKind.None) {
    return { kind: ConditionKind.None }
  }
  const out: any = {
    kind:        ConditionKind.Rule,
    paths:       c.paths,
    operator:    c.operator,
    aggregation: c.aggregation,
  }
  if (OPERATORS_NEEDING_VALUE.has(c.operator) && c.value) {
    out.value = c.value
  }
  return out
}

// ── alertParams shapes (per Source) ────────────────────────────────────────
// The Source itself lives on the alert (`AlertTable.input` / `AlertModel.input`)
// — it is NOT duplicated inside alertParams. These shapes only describe the
// type-specific config. `_`-prefixed keys are runtime state managed by the
// polling engine — they survive serialization but the UI ignores them.

export type PollingParams = {
  url:             string
  format:          PollingFormat
  intervalSeconds: number
  dailyAt?:        string
  condition:       PollingCondition
  _lastHash?:      string
  _baseline?:      any
}

// Webhook alerts carry no type-specific config: their identity comes from the
// alert's `input` (the Source) and `token` (the webhook URL). Reserved as a
// named empty shape so future per-provider config has a place to land.
export type WebhookParams = Record<string, never>

export type AlertParams = PollingParams | WebhookParams | Record<string, any>

// Lightweight model used in the frontend (JSON-safe, id as string)
export type DiscussionModel = {
  id: string
  title: string   // already formatted: "Name" or "Name (group)"
}

// One output of an alert: a list of discussions + a formatting strategy.
export type BundleModel = {
  id?: number
  name?: string
  discussion_list: DiscussionModel[]   // resolved objects in the UI
  formating: Formatting
  custom_script?: string
}

// Full alert as handled by the frontend.
// `input` stores the Source ("Polling Source" | "Webhook Source") — it IS the
// source of truth for the alert's type. alertParams holds only the type-
// specific config; it does not duplicate the source.
export type AlertModel = {
  id: number | null
  title: string
  description: string
  input: Source | string         // Source value; `string` for migration tolerance only
  status: AlertStatus
  token: string
  alertParams?: AlertParams
  bundles: BundleModel[]
}

