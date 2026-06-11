export enum Source {
  // ── Webhook sources ──────────────────────────────────────
  GitHubPush        = 'GitHub Push',
  GitHubPullRequest = 'GitHub Pull Request',
  SentryIssue       = 'Sentry Issue',
  GrafanaAlert      = 'Grafana Alert',
  GitLabPipeline    = 'GitLab Pipeline',
  GenericWebhook    = 'Generic Webhook',

  // ── Polling sources ──────────────────────────────────────
  RSSFeed           = 'RSS Feed',
  GenericAPI        = 'Generic API',
}

export enum Formatting {
  Unformatted = 'Unformatted',
  Simple      = 'Simple',
  Custom      = 'Custom',
}

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
  [Source.RSSFeed]:           [Trigger.Polling],
  [Source.GenericAPI]:        [Trigger.Polling],
}

// ── TriggerParams shapes ────────────────────────────────────────────────────
// Stored as JSON in AlertTable.triggerParams.
// _-prefixed keys are runtime state managed by the polling engine.

export type RSSParams = {
  url:             string
  intervalSeconds: number    // always 86400 when dailyAt is set
  dailyAt?:        string    // "HH:MM" — only present when intervalSeconds === 86400
  keyword?:        string    // optional filter on item title/description
  _lastSeenId?:    string    // guid/id of the last item that fired an alert
}

export type GenericAPIParams = {
  url:             string
  intervalSeconds: number
  dailyAt?:        string    // "HH:MM" — only present when intervalSeconds === 86400
  _lastHash?:      string    // SHA-256 of last response body
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

// 🌟 Type the structure so TypeScript can help us
export interface TemplateData {
  payload: object;
  script: string;
}

// 🌟 Merge everything into a single master object
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

  [Source.RSSFeed]: {
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
  },
}