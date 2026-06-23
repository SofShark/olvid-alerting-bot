// Two-level taxonomy:
//   AlertType  ← top axis ("how does the trigger arrive")
//   Source     ← the specific provider, scoped under an AlertType
//
// On the DB side this maps to:
//   AlertTable.input        stores an AlertType value (e.g. "Polling", "Webhook")
//   AlertTable.alertParams  stores a JSON object whose shape depends on AlertType.
//                           For both types it carries `source` (the provider name);
//                           polling additionally carries url/format/intervalSeconds/condition.

export enum AlertType {
  Polling  = 'Polling',
  Webhook  = 'Webhook',
  MsgOlvid = 'Message Olvid',   // reserved — Olvid-platform events; no sources yet
}

// Backward-compat alias for code still importing `Trigger`. New code should
// use AlertType. Safe to delete after a full sweep.
export const Trigger = AlertType
export type Trigger = AlertType

export enum Source {
  // ── Webhook sources ──────────────────────────────────────
  GitHubPush        = 'GitHub Push',
  GitHubPullRequest = 'GitHub Pull Request',
  SentryIssue       = 'Sentry Issue',
  GrafanaAlert      = 'Grafana Alert',
  GitLabPipeline    = 'GitLab Pipeline',
  GenericWebhook    = 'Generic Webhook',

  // ── Polling sources ──────────────────────────────────────
  Polling           = 'Polling Source',
}

// Grouping that drives the wizard's source selector and the `isPolling`
// runtime check. Adding a new AlertType = add an entry here + a step-flow
// branch in AlertWizard.
export const sourcesByAlertType: Record<AlertType, Source[]> = {
  [AlertType.Polling]: [Source.Polling],
  [AlertType.Webhook]: [
    Source.GenericWebhook,
    Source.GitHubPush,
    Source.GitHubPullRequest,
    Source.SentryIssue,
    Source.GrafanaAlert,
    Source.GitLabPipeline,
  ],
  [AlertType.MsgOlvid]: [],
}

// Inverse: given a Source, what AlertType does it belong to? Used by the
// legacy migration helper below — new code should branch on alertType, not
// on source name.
export const alertTypeForSource: Record<Source, AlertType> = (() => {
  const out = {} as Record<Source, AlertType>
  for (const [type, sources] of Object.entries(sourcesByAlertType)) {
    for (const s of sources) out[s] = type as AlertType
  }
  return out
})()

// Backward-compat alias: pre-refactor code used `sourceTriggers[source]` to
// resolve a Source to its AlertType list (always one element). Derived from
// `alertTypeForSource` to keep one source of truth. New code should use
// alertTypeForSource directly.
export const sourceTriggers: Record<Source, AlertType[]> = (() => {
  const out = {} as Record<Source, AlertType[]>
  for (const [src, type] of Object.entries(alertTypeForSource)) {
    out[src as Source] = [type]
  }
  return out
})()

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

// `input` now stores an AlertType value, but legacy rows in the DB (and
// older in-memory shapes) carry a Source name there. This helper normalises:
//   - 'Polling' / 'Webhook' / 'Message Olvid' → returned as-is
//   - 'Polling Source' / 'GitHub Push' / …    → mapped to their AlertType
//   - anything unrecognised                    → AlertType.Webhook (safest)
export function migrateAlertType(raw: any): AlertType {
  const v = String(raw ?? '').trim()
  if (v === AlertType.Polling || v === AlertType.Webhook || v === AlertType.MsgOlvid) {
    return v as AlertType
  }
  return alertTypeForSource[v as Source] ?? AlertType.Webhook
}

// True for the polling AlertType — replaces the old name-sniffing
// `isPollingSource(s)`. Now an explicit type check.
export const isPolling = (alertType: string | undefined | null): boolean =>
  migrateAlertType(alertType) === AlertType.Polling

// Backward-compat: existing call sites used isPollingSource(form.input)
// when input was the source name. Same call shape, same result post-
// migration thanks to migrateAlertType normalising legacy values.
export const isPollingSource = isPolling

// ── TriggerParams shapes ────────────────────────────────────────────────────
// Stored as JSON in AlertTable.triggerParams.
// _-prefixed keys are runtime state managed by the polling engine.

// Condition that decides whether a poll cycle actually fires the alert.
//
// Excel-style condition. Stored as a single homogeneous shape: every rule
// field (paths/operator/value/aggregation) is present regardless of `kind`,
// so flipping between None/Rule in the UI doesn't lose any in-progress
// configuration. The minimal "kind: None only" shape is produced at *save
// time* by `compactCondition` — see below.
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

// ── alertParams shapes (per AlertType) ─────────────────────────────────────
// All shapes carry `source` (the specific provider name). Polling additionally
// carries url/format/interval/condition. `_`-prefixed keys are runtime state
// managed by the polling engine — they survive serialization but the UI
// ignores them.

export type PollingParams = {
  source:          Source           // e.g. Source.Polling — room for specialized variants later
  url:             string
  format:          PollingFormat
  intervalSeconds: number
  dailyAt?:        string
  condition:       PollingCondition
  _lastHash?:      string
  _baseline?:      any
}

export type WebhookParams = {
  source: Source                    // e.g. Source.GitHubPush, Source.GenericWebhook
}

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
// `input` now stores AlertType. The specific provider lives in alertParams.source.
// `triggerType` is gone — alertType IS the type discriminator.
export type AlertModel = {
  id: number | null
  title: string
  description: string
  input: AlertType | string         // AlertType value at runtime; string for migration tolerance
  status: AlertStatus
  token: string
  alertParams?: AlertParams         // renamed from triggerParams
  bundles: BundleModel[]
}

// Type the structure so TypeScript can help us
export interface TemplateData {
  payload: object;
  script: string;
}

// Merge everything into a single master object
export const sampleData: Record<Source, TemplateData> = {
  [Source.GitHubPush]: {
    payload:{
      ref: "refs/heads/main",
      repository: {
        name: "mi-proyecto-genial",
        // ... otros datos ...
      },
      commits: [
        {
          author: { "name": "Sofia" },
          modified: ["src/styles/main.css", "index.html"],
          message: "defined new interface"
        },
        {
          author: { "name": "tu-usuario" },
          modified: ["readme.md"],
          message: "deleted outdated box definition"
        }
      ]
    },
    script: `🔧 **New Push in {{repository.name}}**
User {{commits.[0].author}} has pushed code to the {{repository.name}} repository.
Latest commit: {{commits.[0].message}}`
  },

  [Source.GitHubPullRequest]: {
    payload: {
      action: 'opened',
      number: 42,
      pull_request: { title: 'Add feature X', user: { login: 'bob' }, html_url: 'https://github.com/org/repo/pull/42' },
    },
    script: `🔄 **Pull Request #{{number}} {{action}}**
Title: {{pull_request.title}}
Author: {{pull_request.user.login}}
Link: {{pull_request.html_url}}`
  },

  [Source.GrafanaAlert]: {
    
    payload: {
      status: 'firing',
      labels: { severity: 'critical', instance: 'database-node-01' },
      annotations: { summary: 'CPU overload detected (> 95%)' },
    },
    script: `🚨 **Grafana Alert: {{status}}**
Severity: {{labels.severity}}
Affected instance: {{labels.instance}}
Details: {{annotations.summary}}`
  },

  [Source.SentryIssue]: { 
     
    payload: {
      event: { title: 'ZeroDivisionError', culprit: 'app/views.py in divide', level: 'error' },
      url: 'https://sentry.io/org/project/issues/123/',
    },
    script: `🐞 **Sentry Error ({{event.level}})**
Failure: {{event.title}}
Location: {{event.culprit}}
View issue: {{url}}`
  },

  [Source.GitLabPipeline]: {
    payload: {
      object_kind: 'pipeline',
      object_attributes: { status: 'failed', ref: 'main', duration: 34 },
      project: { name: 'my-app', web_url: 'https://gitlab.com/org/my-app' },
    },
    script: `🚀 **GitLab Pipeline: {{object_attributes.status}}**
Project: {{project.name}}
Branch: {{object_attributes.ref}}
Duration: {{object_attributes.duration}} seconds`
  },

  [Source.GenericWebhook]: {
    payload: {
      event: 'triggered',
      data: { key: 'value' },
    },
    script: `🔔 **Webhook Event Received**
Event type: {{event}}
Primary key: {{data.key}}`
  },

  [Source.Polling]: {
    payload: {
      // Sample XML entry, parsed into a generic JSON shape at poll time.
      entry: {
        title:   'New release: v2.4.0',
        link:    'https://example.com/blog/release-v2-4-0',
        updated: '2026-06-11T10:00:00Z',
        summary: 'This release includes performance improvements and bug fixes.',
      },
    },
    script: `📡 **Polling update**
{{entry.title}}`
  },

  /*[Source.RSSFeed]: {
    payload: {
      item: {
        title:       'New release: v2.4.0',
        link:        'https://example.com/blog/release-v2-4-0',
        pubDate:     '2026-06-11T10:00:00Z',
        contentSnippet: 'This release includes performance improvements and bug fixes.',
        guid:        'https://example.com/blog/release-v2-4-0',
      },
      feedTitle: 'Example Project Blog',
    },
    script: `📰 **{{feedTitle}}**
{{item.title}}
{{item.pubDate}}
{{item.link}}`
  },

  [Source.GenericAPI]: {
    payload: {
      status:    'degraded',
      updatedAt: '2026-06-11T10:00:00Z',
      components: [
        { name: 'API', status: 'operational' },
        { name: 'Dashboard', status: 'degraded' },
      ],
    },
    script: `⚠️ **API status changed: {{status}}**
Updated: {{updatedAt}}
{{#each components}}• {{name}}: {{status}}
{{/each}}`
  },*/
}