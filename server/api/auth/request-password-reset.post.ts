// Kick off a self-service password reset. Delivery channel is picked
// from the user's persisted contact info:
//   1. `olvidDiscussionId` set  → DM the reset URL via the daemon
//   2. else `email` set + SMTP up → email the reset URL
//   3. else                       → no delivery attempted
//
// The response is ALWAYS { ok: true, delivered: false, channel: "none" },
// regardless of whether the login exists, whether a channel was picked,
// whether the rate-limit fired, or whether delivery actually succeeded.
// Distinguishing any of those to an anonymous caller enumerates accounts
// (existence) and profiles their delivery channel (Olvid vs mail). The
// UI shows one generic "if we recognized you, we've sent instructions"
// message and lets the user check their real mailbox or discussion.
//
// Rate limit: reuse the 60-second same-user cap already used by
// resend-verification, via findMostRecentByUser. Applies only when the
// user is deliverable — an undeliverable request is a no-op anyway.

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

/** Fixed opaque response — never varies with server-side state so no
 *  bit of information about a login can leak to an anonymous caller. */
const OPAQUE_RESPONSE: RequestPasswordResetResponse = {
  ok: true,
  delivered: false,
  channel: "none",
};

export default defineEventHandler(
  async (event): Promise<RequestPasswordResetResponse> => {
    const { login } = await readBodyOr400(event, bodySchema);

    // All the branches below share the same return: `OPAQUE_RESPONSE`.
    // Delivery is best-effort side-effect only; errors are logged and
    // swallowed so timing / status / message do not leak either.
    try {
      const user = await userRepository.getByLogin(login);
      if (!user) return OPAQUE_RESPONSE;

      const channel = await pickChannel(user);
      if (channel === "none") return OPAQUE_RESPONSE;

      const recent = await verificationTokenRepository.findMostRecentByUser(
        user.id,
        "password_reset",
      );
      if (recent && Date.now() - recent.createdAt.getTime() < RATE_LIMIT_MS) {
        return OPAQUE_RESPONSE;
      }

      const token = await issueToken(user.id, "password_reset");
      const origin = resolveOrigin(event);

      if (channel === "olvid" && user.olvidDiscussionId != null) {
        await olvidClient.sendMessage(
          [user.olvidDiscussionId],
          resetPasswordOlvidMessage(origin, token),
        );
      } else if (channel === "mail" && user.email) {
        const { subject, html } = resetPasswordEmail(origin, token);
        await mailClient.send([user.email], subject, html);
      }
    } catch (error) {
      console.error("[request-password-reset] delivery error:", error);
    }

    return OPAQUE_RESPONSE;
  },
);
