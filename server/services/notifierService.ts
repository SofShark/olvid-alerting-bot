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
  type Formatting,
  type MailOutputParams,
  type OlvidOutputParams,
} from "#shared/types/bundle";
import type { ChannelReport } from "#shared/types/dispatchStrategy";

export type FireKind = "alert" | "recovery";

// Structural shapes for what the notifier actually reads off a fired
// alert. These mirror the Prisma row + nested `include` used by
// alertRepository (bundles → outputs) rather than the client-side
// AlertModel, which carries a slightly different shape (id nullable,
// no createdAt, etc.). Payloads stay `unknown` — they're arbitrary
// webhook / parsed-source JSON and only formatter strategies interpret
// them.
export interface FiredBundleOutput {
  type: string;
  params: unknown;
}

export interface FiredBundle {
  id: number;
  name?: string | null;
  formating: Formatting | string;
  custom_script?: string | null;
  outputs?: FiredBundleOutput[];
}

export interface FiredAlert {
  id: number;
  title: string;
  status: string;
  bundles?: FiredBundle[];
}

const RECOVERY_PREFIX = "✓ RECOVERED:";

export const notifierService = {
  async getDiscussionList() {
    return await olvidClient.getDiscussions();
  },

  // Entry point for an incoming webhook (or polling tick). The alert is
  // resolved by token / id and carries its bundles. Each bundle is one
  // output (audience + format). Returns the flattened ChannelReport list
  // aggregated across every bundle so the caller (webhook handler /
  // dispatcher) can record what actually happened per channel.
  async processAlert(
    alert: FiredAlert,
    payload: unknown,
    kind: FireKind = "alert",
  ): Promise<ChannelReport[]> {
    console.log(
      `⚙️ Processing alert #${alert.id}: ${alert.title}${kind === "recovery" ? " (recovery)" : ""}`,
    );

    if (alert.status !== AlertStatus.Active) {
      console.log(
        `The alert is not active (status: ${alert.status}) — skipping`,
      );
      return [];
    }

    const bundles = alert.bundles ?? [];
    if (bundles.length === 0) {
      console.warn(`⚠️ Alert #${alert.id} is active but has no bundles`);
      return [];
    }

    // Fire every bundle in parallel, then flatten. Each bundle's channel
    // reports are independent — a failure on one bundle's Olvid channel
    // must not hide a success on another bundle's mail channel.
    const perBundle = await Promise.all(
      bundles.map((bundle) => this.processBundle(alert, bundle, payload, kind)),
    );
    return perBundle.flat();
  },

  async processBundle(
    alert: FiredAlert,
    bundle: FiredBundle,
    payload: unknown,
    kind: FireKind = "alert",
  ): Promise<ChannelReport[]> {
    const outputs = bundle.outputs ?? [];

    if (outputs.length === 0) {
      console.warn(
        `⚠️ Bundle #${bundle.id} of alert #${alert.id} has no outputs`,
      );
      return [];
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
    // the other. Both clients swallow errors internally and return bool;
    // we capture that boolean into a ChannelReport per channel so the
    // caller can render a per-channel breakdown.
    const subject =
      kind === "recovery" ? `${RECOVERY_PREFIX} ${alert.title}` : alert.title;

    const dispatches: Array<Promise<ChannelReport | null>> = [];
    if (olvidDiscussions.length > 0) {
      dispatches.push(
        sendOlvid(olvidDiscussions, message).catch(
          (err): ChannelReport => ({
            channel: "olvid",
            ok: false,
            recipients: olvidDiscussions.length,
            error: errorMessage(err),
          }),
        ),
      );
    }
    if (mailAddresses.length > 0) {
      dispatches.push(
        sendMail(mailAddresses, subject, message).catch(
          (err): ChannelReport => ({
            channel: "mail",
            ok: false,
            recipients: mailAddresses.length,
            error: errorMessage(err),
          }),
        ),
      );
    }

    const settled = await Promise.all(dispatches);
    return settled.filter((r): r is ChannelReport => r !== null);
  },

  formatMessage(
    alert: FiredAlert,
    bundle: FiredBundle,
    payload: unknown,
    kind: FireKind = "alert",
  ): string {
    const body = renderBody(alert, bundle, payload);
    return kind === "recovery" ? `${RECOVERY_PREFIX} ${body}` : body;
  },
};

// Internal: builds the bundle's message body (no recovery prefix). The
// per-format logic lives in server/services/formatters/ — one strategy
// per Formatting value, selected by the factory. Strategies never throw.
function renderBody(
  alert: FiredAlert,
  bundle: FiredBundle,
  payload: unknown,
): string {
  return formatterFactory
    .forFormatting(bundle.formating)
    .render(alert, bundle, payload);
}

/** Wrap the Olvid client's boolean return in a ChannelReport. Client
 *  swallows individual send errors internally and returns false when
 *  any fell over — we don't have per-recipient granularity from the
 *  daemon today, so we report the batch outcome. */
async function sendOlvid(
  discussions: bigint[],
  message: string,
): Promise<ChannelReport> {
  const ok = await olvidClient.sendMessage(discussions, message);
  return {
    channel: "olvid",
    ok,
    recipients: discussions.length,
    error: ok ? undefined : "Olvid daemon reported a send failure",
  };
}

/** Same shape as sendOlvid — wraps the mailClient's `allOk` boolean. */
async function sendMail(
  addresses: string[],
  subject: string,
  message: string,
): Promise<ChannelReport> {
  const ok = await mailClient.send(addresses, subject, message);
  return {
    channel: "mail",
    ok,
    recipients: addresses.length,
    error: ok ? undefined : "MailPace rejected one or more recipients",
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
}
