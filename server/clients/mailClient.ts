// Mail client — MailPace HTTP API wrapper (via @mailpace/mailpace.js).
//
// Env vars (all read at module load, only PASSWORD + FROM are strictly
// required — the SMTP_HOST / SMTP_PORT / SMTP_USER trio remains in
// `.env` for historical reasons but is unused now that we're on the
// JSON API):
//
//   SMTP_PASSWORD   — MailPace Domain Server Token (the API secret)
//   SMTP_FROM       — verified From address on the MailPace domain
//
// External SDK boundary — the MailPace SDK stays inside this file. If we
// swap providers, only this file changes.
//
// Delivery semantics: one send per recipient (no BCC — recipients don't
// see each other, and a single bad address doesn't fail the batch).
// Errors are logged and returned as a boolean — we never throw, so a
// mail failure can't take down the notifier or block olvid delivery in
// the same bundle. The polling recovery state machine keys on the
// condition verdict, not delivery success, so a mail failure has no
// effect on whether the alert stays armed.

import MailPace from "@mailpace/mailpace.js";
import { olvidMarkupToHtml, olvidMarkupToPlainText } from "#shared/olvidMarkup";

const PASSWORD = process.env.SMTP_PASSWORD;
const FROM = process.env.SMTP_FROM;

let client: MailPace.DomainClient | null = null;
let warnedMissing = false;

function getClient(): MailPace.DomainClient | null {
  if (client) return client;
  if (!PASSWORD || !FROM) {
    if (!warnedMissing) {
      console.warn(
        "⚠️ [Mail] SMTP_PASSWORD or SMTP_FROM missing. Mail outputs will be skipped.",
      );
      warnedMissing = true;
    }
    return null;
  }
  client = new MailPace.DomainClient(PASSWORD);
  return client;
}

// Olvid-markup ↔ HTML/plain conversions live in #shared/olvidMarkup so
// the mail preview (client) and this sender (server) stay in lockstep.

export const mailClient = {
  async send(
    addresses: string[],
    subject: string,
    body: string,
  ): Promise<boolean> {
    if (addresses.length === 0) return true;
    const c = getClient();
    if (!c) return false;

    const htmlbody = olvidMarkupToHtml(body);
    const textbody = olvidMarkupToPlainText(body);

    let allOk = true;
    for (const address of addresses) {
      try {
        await c.sendEmail({
          from: FROM!,
          to: address,
          subject,
          htmlbody,
          textbody,
        });
        console.log(`✅ [Mail] Message sent to: ${address}`);
      } catch (error: any) {
        allOk = false;
        console.error(
          `❌ [Mail] Failed to send to ${address}:`,
          error?.message ?? error,
        );
      }
    }
    return allOk;
  },
};
