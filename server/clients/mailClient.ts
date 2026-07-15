// SMTP client — mirror of olvidClient's shape for the "mail" channel.
//
// Reads SMTP settings from environment variables (`SMTP_HOST`,
// `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`). No secrets
// live in the repo — the developer's `.env` (untracked) holds the
// provider token; the Docker container gets them via `env_file`.
//
// External SDK boundary — nodemailer stays inside this file. If we
// swap providers (Postmark, SES, …), only this file changes.
//
// Delivery semantics: one `sendMail` per recipient. Recipients don't see
// each other, and a single bad address doesn't fail the batch. Errors
// are logged and turned into a boolean return — we never throw, so a
// mail failure can't take down the notifier or block olvid delivery in
// the same bundle. The polling recovery state machine keys on the
// condition verdict, not delivery success, so a mail send failure has
// no effect on whether the alert stays armed.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// The formatter output is rendered with Olvid's chat conventions in mind
// (`**bold**` is bold in Olvid). In a plain-text email those markers
// leak through as literal asterisks, so we strip them here — one place
// in the mail boundary rather than a per-channel branch in the formatter.
// Only `**bold**` for now; extend if / when the script editor grows more
// Olvid-specific markup (`_italic_`, `~strike~`, …).
function stripOlvidMarkup(body: string): string {
  return body.replace(/\*\*(.+?)\*\*/g, "$1");
}

const HOST = process.env.SMTP_HOST;
const PORT = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
const USER = process.env.SMTP_USER;
const PASSWORD = process.env.SMTP_PASSWORD!;
const FROM = process.env.SMTP_FROM!;


import MailPace from '@mailpace/mailpace.js'
const client = new MailPace.DomainClient(PASSWORD);


export const mailClient = {
  async send(
    addresses: string[],
    subject: string,
    body: string,
  ): Promise<boolean> {
    if (addresses.length === 0) return true;

    const mailBody = stripOlvidMarkup(body);

    let allOk = true;
    for (const address of addresses) {
      try {
        client.sendEmail({
          from: FROM,
          to: address,
          subject: subject,
          htmlbody: mailBody,
        }).
        then((r) => console.log());
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