// Dev-defined library of webhook examples — one entry per provider, each
// pairing a sample payload (the data Handlebars receives) with a matching
// Handlebars template (the user-editable script).
//
// Storage choice:
//   - Payloads live in sibling `.json` files. That IS the format Handlebars
//     consumes at runtime, so JSON files double as living documentation of
//     each provider's webhook shape.
//   - Scripts live as TypeScript template literals here in `index.ts`. They
//     are Handlebars templates with `{{…}}` and multi-line content — keeping
//     them as native TS strings avoids escaping every newline into JSON.
//
// Imported directly by the front (FormatEditor's "Load Data ▼" and the
// modal-header "Quick Templates" button) via Nuxt's `#shared` alias — no
// API roundtrip. Same registry is also available to the server (alert
// manager) through the same import; `shared/` is the only layer that's
// import-safe from both sides.
//
// Adding a provider: drop a new `.json` next to the others, then add one
// import + one REGISTRY entry + one entry to the WebhookTemplateId union.

import githubPushPayload from "./github-push.json";
import githubPullRequestPayload from "./github-pull-request.json";
import githubIssuePayload from "./github-issue.json";
import githubWorkflowRunPayload from "./github-workflow-run.json";
import grafanaAlertPayload from "./grafana-alert.json";
import sentryIssuePayload from "./sentry-issue.json";

export type WebhookTemplateId =
  | "github-push"
  | "github-pull-request"
  | "github-issue"
  | "github-workflow-run"
  | "grafana-alert"
  | "sentry-issue"


export type WebhookTemplate = {
  id: WebhookTemplateId;
  label: string; // shown in dropdowns ("GitHub Push")
  icon?: string; // optional emoji / icon key ("🐙")
  payload: unknown; // the JSON sample — sourced from the sibling .json
  script: string; // matching Handlebars template
};

// Insertion order drives dropdown order — keep the most-likely-picked
// providers near the top.
const REGISTRY: Record<WebhookTemplateId, WebhookTemplate> = {
  "github-push": {
    id: "github-push",
    label: "GitHub Push",
    icon: "🐙",
    payload: githubPushPayload,
    script: `🔧 **New Push in {{repository.name}}**
User {{commits.[0].author.name}} has pushed code to the {{repository.name}} repository.
Latest commit: {{commits.[0].message}}`,
  },

  "github-pull-request": {
    id: "github-pull-request",
    label: "GitHub Pull Request",
    icon: "🔀",
    payload: githubPullRequestPayload,
    script: `🔄 **Pull Request #{{number}} {{action}}**
Title: {{pull_request.title}}
Author: {{pull_request.user.login}}
Link: {{pull_request.html_url}}`,
  },

  "github-issue": {
    id: "github-issue",
    label: "GitHub Issue",
    icon: "📋",
    payload: githubIssuePayload,
    script: `📋 **Issue #{{issue.number}} {{action}}** — {{issue.title}}
Repo: {{repository.full_name}}
Author: {{issue.user.login}}
Labels: {{#each issue.labels}}\`{{name}}\`{{#unless @last}}, {{/unless}}{{/each}}
{{issue.html_url}}`,
  },

  "github-workflow-run": {
    id: "github-workflow-run",
    label: "GitHub Workflow Run",
    icon: "⚙️",
    payload: githubWorkflowRunPayload,
    script: `⚙️ **Workflow \`{{workflow_run.name}}\`: {{workflow_run.conclusion}}**
Repo: {{repository.full_name}}
Branch: \`{{workflow_run.head_branch}}\` (run #{{workflow_run.run_number}}, on {{workflow_run.event}})
By: {{workflow_run.actor.login}}
{{workflow_run.html_url}}`,
  },

  "grafana-alert": {
    id: "grafana-alert",
    label: "Grafana Alert",
    icon: "📊",
    payload: grafanaAlertPayload,
    script: `🚨 **Grafana Alert: {{status}}**
Severity: {{labels.severity}}
Affected instance: {{labels.instance}}
Details: {{annotations.summary}}`,
  },

  "sentry-issue": {
    id: "sentry-issue",
    label: "Sentry Issue",
    icon: "🐞",
    payload: sentryIssuePayload,
    script: `🐞 **Sentry Error ({{event.level}})**
Failure: {{event.title}}
Location: {{event.culprit}}
View issue: {{url}}`,
  },
};

/** Ordered list — drives v-for in the "From Library" and "Quick Templates" dropdowns. */
export const webhookTemplateList: WebhookTemplate[] = Object.values(REGISTRY);

/**
 * Front-end contract: hand back the full template object for a given provider
 * id, or null if the id is unknown. The ONLY supported way to read the
 * registry — callers must not import REGISTRY directly so the storage shape
 * can evolve (lazy-loaded modules, DB-backed entries) without breaking call
 * sites.
 *
 * Used by the 🪄 Quick Templates header button, which applies BOTH the
 * payload AND the script atomically.
 */
export function getWebhookTemplate(id: string): WebhookTemplate | null {
  return (REGISTRY as Record<string, WebhookTemplate>)[id] ?? null;
}

/**
 * Just the payload, pretty-stringified for direct dump into the JSON textarea.
 * Used by the "Load Data ▼ → From Library" dropdown, which loads the payload
 * FIRST and then asks whether to also apply the matching script.
 */
export function getWebhookPayloadJson(id: string): string | null {
  const t = getWebhookTemplate(id);
  return t ? JSON.stringify(t.payload, null, 2) : null;
}

/**
 * Just the matching Handlebars script. Used as the second half of the
 * "Apply matching template?" confirmation in the Library flow.
 */
export function getWebhookScript(id: string): string | null {
  return getWebhookTemplate(id)?.script ?? null;
}
