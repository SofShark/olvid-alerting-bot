// Mail client (via @mailpace/mailpace.js).
//
// Env vars (all read at module load, only PASSWORD + FROM are strictly
// required — the SMTP_HOST / SMTP_PORT / SMTP_USER trio remains in
// `.env` for historical reasons but is unused now that we're on the
// JSON API):
//
//   SMTP_PASSWORD   — MailPace Domain Server Token (the API secret)
//   SMTP_FROM       — verified From address on the MailPace domain
//
// The MailPace SDK stays inside this file. If we
// swap providers, only this file changes.

import MailPace from "@mailpace/mailpace.js";

const PASSWORD = process.env.SMTP_PASSWORD;
const FROM = process.env.SMTP_FROM;

let client: MailPace.DomainClient | null = null;
let warnedMissing = false; // Flag to detect unset smtp env variables => mail services unavailable

function getClient(): MailPace.DomainClient | null {
  if (client) return client;
  if (!PASSWORD || !FROM) {
    if (!warnedMissing) {
      console.warn(
        "[Mail] SMTP_PASSWORD or SMTP_FROM missing. Mail outputs will be skipped.",
      );
      warnedMissing = true;
    }
    return null;
  }
  client = new MailPace.DomainClient(PASSWORD);
  return client;
}

export const mailClient = {
  /** Check if the SMTP env vars set. 
   * Used to keep unavailable mail option out of the ui */
  isAvailable(): boolean {
    return Boolean(PASSWORD && FROM);
  },

  async send(
    addresses: string[],
    subject: string,
    htmlbody: string,
  ): Promise<boolean> {

    if (addresses.length === 0) return true;
    const c = getClient();
    if (!c) return false;

    let allOk = true;
    await Promise.allSettled(
      addresses.map((address) =>
        c.sendEmail({
          from: FROM!,
          to: address,
          subject,
          htmlbody
        }).then(() =>{
          console.log(`[mailClient] Message sent to ${address}`);
        }).catch((error: any) => {
          allOk = false;
          console.error(
            `[mailClient] Failed to send to ${address}:`,
            error?.message ?? error,);
          }
        )      
      )
    )
    
    return allOk;
  },  
};
