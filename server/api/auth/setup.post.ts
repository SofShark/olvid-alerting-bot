// First-run only: creates the first admin account.
//
// Hard gates before any account is created:
//   1. `ADMIN_KEY` env must be set — a missing key means the operator
//      hasn't authorised initial setup, so we refuse (503).
//   2. Submitted adminKey must match, using a constant-time compare
//      so the endpoint can't be probed via response timing.
//   3. No admin may already exist (409). Setup is one-shot.
//
// Two flavours after the gates pass:
//   - With SMTP and an email supplied: verification email is sent,
//     account stays inactive until the link is clicked.
//   - Without SMTP or without an email: account is activated
//     immediately and the admin is signed in. Knowledge of ADMIN_KEY
//     IS the verification in that path.

import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { userRepository } from "#server/repositories/userRepository";
import { issueToken, resolveOrigin, toClientUser } from "#server/utils/auth";
import { verifyEmail as verifyEmailTemplate } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";
import type { SetupForm } from "#shared/types/auth";

const bodySchema = z.object({
  adminKey: z.string().min(1),
  login: z.string().trim().min(1),
  email: z.email().optional(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
}) satisfies z.ZodType<SetupForm>;

function secretsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export default defineEventHandler(async (event) => {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: "admin_key_not_configured",
    });
  }

  const parsed = await readValidatedBody(event, bodySchema.parse);

  if (!secretsMatch(parsed.adminKey, expected)) {
    throw createError({ statusCode: 401, statusMessage: "invalid_admin_key" });
  }

  if (await userRepository.findFirstAdmin()) {
    throw createError({
      statusCode: 409,
      statusMessage: "setup_already_complete",
    });
  }

  const email = parsed.email ?? null;
  // With an email supplied the login is normalised to it (so the admin
  // types the same thing everywhere). Without email, the typed login stands.
  const login = email ?? parsed.login;
  const passwordHash = await hashPassword(parsed.password);
  const mailAvailable = mailClient.isAvailable() && Boolean(email);

  const user = await userRepository.create({
    login,
    email,
    passwordHash,
    name: parsed.name ?? null,
    role: "admin",
    activatedAt: mailAvailable ? null : new Date(),
  });

  if (mailAvailable && email) {
    const token = await issueToken(user.id, "email_verify");
    const { subject, html } = verifyEmailTemplate(resolveOrigin(event), token);
    await mailClient.send([email], subject, html);
    return { ok: true, requiresVerification: true };
  }

  await setUserSession(event, { user: toClientUser(user) });
  return { ok: true, requiresVerification: false, user: toClientUser(user) };
});
