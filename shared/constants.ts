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

export enum Trigger{
  Webhook = 'Webhook',
  Polling = 'Polling',
  MsgOlvid = 'Message Olvid'
}

export enum AlertStatus {
  Draft    = 'draft',
  Inactive = 'inactive',
  Active   = 'active',
}

// Which triggers each input source supports.
export const sourceTriggers: Record<Source, Trigger[]> = {
  [Source.GitHubPush]:        [Trigger.Webhook],
  [Source.GitHubPullRequest]: [Trigger.Webhook],
  [Source.SentryIssue]:       [Trigger.Webhook],
  [Source.GrafanaAlert]:      [Trigger.Webhook],
  [Source.GitLabPipeline]:    [Trigger.Webhook],
  [Source.GenericWebhook]:    [Trigger.Webhook],
  [Source.Polling]:           [Trigger.Polling],
}

// Sources whose trigger is polling-based (require URL/format/interval + condition).
export const POLLING_SOURCES: ReadonlySet<Source> = new Set([Source.Polling])
export const isPollingSource = (s: string): boolean =>
  POLLING_SOURCES.has(s as Source)

// ── TriggerParams shapes ────────────────────────────────────────────────────
// Stored as JSON in AlertTable.triggerParams.
// _-prefixed keys are runtime state managed by the polling engine.

// Condition that decides whether a poll cycle actually fires the alert.
//
// Excel-style: pick 1+ leaf paths in the parsed source, choose an operator,
// optionally provide a literal value, and (when watching >1 path) decide
// whether ALL paths must verify or ANY of them is enough.
export type PollingCondition =
  | { kind: ConditionKind.None }
  | {
      kind:        ConditionKind.Rule
      paths:       string[]                // dot-paths into the parsed object
      operator:    ConditionOperator
      value?:      string                  // unused for `changed`
      aggregation: ConditionAggregation    // ignored when paths.length === 1
    }

// Migrate legacy shape `{ kind: 'field_changed', field: 'x' }` (pre-rule)
// to the new rule shape, so saved drafts keep working. Returns the input
// unchanged when it already matches the new shape.
export function migrateCondition(c: any): PollingCondition {
  if (!c || typeof c !== 'object') return { kind: ConditionKind.None }
  if (c.kind === ConditionKind.None) return { kind: ConditionKind.None }
  if (c.kind === ConditionKind.Rule) {
    return {
      kind:        ConditionKind.Rule,
      paths:       Array.isArray(c.paths) ? c.paths.filter(Boolean) : [],
      operator:    (c.operator    ?? ConditionOperator.Changed) as ConditionOperator,
      value:       typeof c.value === 'string' ? c.value : undefined,
      aggregation: (c.aggregation ?? ConditionAggregation.All) as ConditionAggregation,
    }
  }
  // Legacy: { kind: 'field_changed', field: 'x.y.z' } → single-path Changed.
  if (c.kind === 'field_changed' && typeof c.field === 'string') {
    return {
      kind:        ConditionKind.Rule,
      paths:       c.field ? [c.field] : [],
      operator:    ConditionOperator.Changed,
      aggregation: ConditionAggregation.All,
    }
  }
  return { kind: ConditionKind.None }
}

// Unified shape stored in AlertTable.triggerParams for polling alerts.
export type PollingParams = {
  url:             string
  format:          PollingFormat
  intervalSeconds: number
  dailyAt?:        string
  condition:       PollingCondition
  _lastHash?:      string          // runtime state, managed by the polling engine
}

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
export type AlertModel = {
  id: number | null
  title: string
  description: string
  input: string
  triggerType: string
  status: AlertStatus
  token: string
  triggerParams?: Record<string, any>
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
    script: `🔧 **New Push in {{repository.full_name}}**
User {{pusher.name}} has pushed code to the {{ref}} branch.
Latest commit ({{commits.[0].id}}): {{commits.[0].message}}`
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