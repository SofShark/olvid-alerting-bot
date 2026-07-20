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

import { AlertStatus } from "#shared/types/alert";
import {
  BundleOutputType,
  MailOutputParams,
  OlvidOutputParams,
} from "#shared/types/bundleOutput";

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
    const outputs = (bundle.outputs ?? []) as Array<{
      type: string;
      params: any;
    }>;

    if (outputs.length === 0) {
      console.warn(
        `⚠️ Bundle #${bundle.id} of alert #${alert.id} has no outputs`,
      );
      return;
    }

    const message = this.formatMessage(alert, bundle, payload, kind);

    // Dispatch by output.type. Group per channel so we open one round-trip
    // per channel, not per row. Future channels (slack / discord / …) slot in here without touching the caller.
    const olvidDiscussions: bigint[] = [];
    const mailAddresses: string[] = [];
    for (const output of outputs) {
      if (output.type === BundleOutputType.Olvid) {
        const raw = (output.params as OlvidOutputParams)?.discussionId;
        if (raw === null || raw === undefined) continue;
        try {
          olvidDiscussions.push(BigInt(raw));
        } catch {
          console.warn(
            `⚠️ Bundle #${bundle.id}: invalid Olvid discussionId ${JSON.stringify(raw)}`,
          );
        }
      } else if (output.type === BundleOutputType.Mail) {
        const raw = (output.params as MailOutputParams)?.address;
        if (typeof raw === "string" && raw.trim() !== "") {
          mailAddresses.push(raw.trim());
        }
      } else {
        console.warn(
          `⚠️ Bundle #${bundle.id}: unknown output type '${output.type}' — skipping`,
        );
      }
    }

    // Dispatch channels in parallel — one channel's failure can't block
    // the other. Both clients swallow errors internally and return bool.
    const subject =
      kind === "recovery" ? `${RECOVERY_PREFIX} ${alert.title}` : alert.title;
    await Promise.all([
      olvidDiscussions.length > 0
        ? olvidClient.sendMessage(olvidDiscussions, message)
        : Promise.resolve(),
      mailAddresses.length > 0
        ? mailClient.send(mailAddresses, subject, message)
        : Promise.resolve(),
    ]);
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

// Internal: builds the bundle's message body (no recovery prefix). The
// per-format logic lives in server/services/formatters/ — one strategy
// per Formatting value, selected by the factory. Strategies never throw.
function renderBody(alert: any, bundle: any, payload: any): string {
  return formatterFactory
    .forFormatting(bundle.formating)
    .render(alert, bundle, payload);
}
