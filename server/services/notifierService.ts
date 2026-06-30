// Notifier — turns a fired alert into one or more outbound messages.
//
// Renamed from the misleading `alertManager`: this module doesn't "manage"
// alerts (CRUD, status, lifecycle — that's alertService / alertRepository).
// It does ONE thing: given an alert that just fired + the triggering
// payload, format each of its bundles and dispatch the resulting message
// to the configured Olvid discussions via the daemon.
//
// Entry points:
//   - processAlert(alert, payload, kind?) — top of the chain (webhook
//                                           handler, polling engine).
//   - processBundle(alert, bundle, payload, kind?) — fires a single bundle.
//   - formatMessage(alert, bundle, payload, kind?) — builds the string for
//     one bundle (also reused by the "test poll" endpoint to preview).
//
// `kind` is 'alert' by default — the normal fire path. The polling engine
// passes 'recovery' when the WithRecovery trigger mode detects a falling
// edge (condition was true on the last poll, now false). For recovery the
// message gets a "✓ RECOVERED:" prefix; the per-bundle script doesn't need
// to be recovery-aware.

import { Formatting } from "#shared/types/bundle";
import { AlertStatus } from "#shared/types/alert";
import { buildPollingDefaultMessage } from "#shared/polling/message";
import { formatMessage as runHandlebars } from "#shared/handlebars";

export type FireKind = "alert" | "recovery";

const RECOVERY_PREFIX = "✓ RECOVERED:";

export const notifierService = {
  async getDiscussionList() {
    return await olvidClient.getDiscussions();
  },

  // Entry point for an incoming webhook (or polling tick). The alert is
  // resolved by token / id and carries its bundles. Each bundle is one
  // output (audience + format).
  async processAlert(alert: any, payload: any, kind: FireKind = "alert") {
    console.log(
      `⚙️ Processing alert #${alert.id}: ${alert.title}${kind === "recovery" ? " (recovery)" : ""}`,
    );

    if (alert.status !== AlertStatus.Active) {
      console.log(
        `The alert is not active (status: ${alert.status}) — skipping`,
      );
      return;
    }

    const bundles = alert.bundles ?? [];
    if (bundles.length === 0) {
      console.warn(`⚠️ Alert #${alert.id} is active but has no bundles`);
      return;
    }

    // Fire every bundle in parallel.
    await Promise.all(
      bundles.map((bundle: any) =>
        this.processBundle(alert, bundle, payload, kind),
      ),
    );
  },

  async processBundle(
    alert: any,
    bundle: any,
    payload: any,
    kind: FireKind = "alert",
  ) {
    // discussion_list arrives from Prisma as BigInt[]; normalise just in case.
    const discussions = (bundle.discussion_list ?? []).map((id: any) =>
      BigInt(id),
    );

    if (discussions.length === 0) {
      console.warn(
        `⚠️ Bundle #${bundle.id} of alert #${alert.id} has no discussion targets`,
      );
      return;
    }

    const message = this.formatMessage(alert, bundle, payload, kind);
    await olvidClient.sendMessage(discussions, message);
  },

  formatMessage(
    alert: any,
    bundle: any,
    payload: any,
    kind: FireKind = "alert",
  ): string {
    const body = renderBody(alert, bundle, payload);
    return kind === "recovery" ? `${RECOVERY_PREFIX} ${body}` : body;
  },
};

// Internal: builds the bundle's message body (no recovery prefix). Kept
// outside the object so the prefix logic in formatMessage stays in one
// branch — the per-format switch doesn't need to know about kind.
function renderBody(alert: any, bundle: any, payload: any): string {
  const jsonString = JSON.stringify(payload, null, 2);

  switch (bundle.formating) {
    case Formatting.PollingDefault:
      return buildPollingDefaultMessage(alert, payload);

    case Formatting.PollingCustom:
    case Formatting.Custom: {
      try {
        return runHandlebars(bundle.custom_script, payload);
      } catch (error: any) {
        console.error(
          `❌ [Notifier] Error running script for alert **${alert.title}**:`,
          error,
        );
        return `🚨 An error occurred while running the custom script for alert **${alert.title}**\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
      }
    }

    case Formatting.Simple:
      return `🚨 ${alert.title}\n${alert.description ?? ""}\n`;

    default:
      return `\`\`\`json\n${jsonString}\n\`\`\``;
  }
}
