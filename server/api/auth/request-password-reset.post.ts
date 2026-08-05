// Kick off a self-service password reset. Delivery channel is picked
// from the user's persisted contact info:
//   1. `olvidDiscussionId` set  → DM the reset URL via the daemon
//   2. else `email` set + SMTP up → email the reset URL
//   3. else                     → return channel:"none" so the UI can
//                                 tell the user to contact their admin
//
// The response never leaks whether a given login exists — we return
// { ok: true, delivered: false, channel: "none" } for both "unknown
// login" and "known login with no reachable channel". The `channel`
// field tells the UI which copy to render (check your Olvid vs check
// your mail vs contact admin) without pinning to any one identity.
//
// Rate limit: reuse the 60-second same-user cap already used by
// resend-verification, via findMostRecentByUser. Applies only when
// the user is deliverable — an undeliverable request is a no-op
// anyway.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { verificationTokenRepository } from "#server/repositories/verificationTokenRepository";
import { issueToken, resolveOrigin } from "#server/utils/auth";
import {
  resetPasswordEmail,
  resetPasswordOlvidMessage,
} from "#server/utils/authMessages";
import { mailClient } from "#server/clients/mailClient";
import { olvidClient } from "#server/clients/olvidClient";
import { readBodyOr400 } from "#server/utils/httpError";
import type {
  RequestPasswordResetResponse,
  ResetChannel,
} from "#shared/types/auth";

const bodySchema = z.object({
  login: z.string().trim().min(1),
});

const RATE_LIMIT_MS = 60_000;

async function pickChannel(user: {
  olvidDiscussionId: bigint | null;
  email: string | null;
}): Promise<ResetChannel> {
  if (user.olvidDiscussionId != null) return "olvid";
  if (user.email && mailClient.isAvailable()) return "mail";
  return "none";
}

export default defineEventHandler(
  async (event): Promise<RequestPasswordResetResponse> => {
    const { login } = await readBodyOr400(event, bodySchema);

    const user = await userRepository.getByLogin(login);
    if (!user) {
      // Unknown login — still return 200 to blunt account-existence
      // probing, but we obviously can't deliver.
      return { ok: true, delivered: false, channel: "none" };
    }

    const channel = await pickChannel(user);
    if (channel === "none") {
      return { ok: true, delivered: false, channel: "none" };
    }

    // Rate limit — one request per user per RATE_LIMIT_MS window.
    const recent = await verificationTokenRepository.findMostRecentByUser(
      user.id,
      "password_reset",
    );
    if (recent && Date.now() - recent.createdAt.getTime() < RATE_LIMIT_MS) {
      return { ok: true, delivered: false, channel };
    }

    const token = await issueToken(user.id, "password_reset");
    const origin = resolveOrigin(event);

    let delivered = false;
    if (channel === "olvid" && user.olvidDiscussionId != null) {
      delivered = await olvidClient.sendMessage(
        [user.olvidDiscussionId],
        resetPasswordOlvidMessage(origin, token),
      );
    } else if (channel === "mail" && user.email) {
      const { subject, html } = resetPasswordEmail(origin, token);
      delivered = await mailClient.send([user.email], subject, html);
    }

    return { ok: true, delivered, channel };
  },
);
