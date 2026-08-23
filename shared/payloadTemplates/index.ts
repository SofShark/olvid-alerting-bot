// Dev-defined library of webhook payload samples — one entry per provider.
// Each sample IS the JSON body that provider posts to the webhook, so it
// doubles as living documentation of the wire shape.
//
// Payloads are stored in sibling `.json` files (native format for the
// Handlebars runtime). Adding a provider: drop a new `.json`, then add
// one import + one REGISTRY entry + one entry to the WebhookTemplateId
// union.

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
  | "sentry-issue";

export type WebhookTemplate = {
  id: WebhookTemplateId;
  label: string;
  payload: unknown;
};

const REGISTRY: Record<WebhookTemplateId, WebhookTemplate> = {
  "github-push": {
    id: "github-push",
    label: "GitHub Push",
    payload: githubPushPayload,
  },
  "github-pull-request": {
    id: "github-pull-request",
    label: "GitHub Pull Request",
    payload: githubPullRequestPayload,
  },
  "github-issue": {
    id: "github-issue",
    label: "GitHub Issue",
    payload: githubIssuePayload,
  },
  "github-workflow-run": {
    id: "github-workflow-run",
    label: "GitHub Workflow Run",
    payload: githubWorkflowRunPayload,
  },
  "grafana-alert": {
    id: "grafana-alert",
    label: "Grafana Alert",
    payload: grafanaAlertPayload,
  },
  "sentry-issue": {
    id: "sentry-issue",
    label: "Sentry Issue",
    payload: sentryIssuePayload,
  },
};

/** Ordered list — drives v-for in the "From Library" dropdown. */
export const webhookTemplateList: WebhookTemplate[] = Object.values(REGISTRY);

/** Pretty-stringified payload for direct dump into the JSON textarea. */
export function getWebhookPayloadJson(id: string): string | null {
  const t = (REGISTRY as Record<string, WebhookTemplate>)[id];
  return t ? JSON.stringify(t.payload, null, 2) : null;
}
