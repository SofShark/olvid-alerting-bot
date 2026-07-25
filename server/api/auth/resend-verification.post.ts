// Reissues an email_verify token for an unverified account. Best-effort
// rate limit: refuse if the last token for this user was issued < 60 s
// ago. Always returns { ok: true } even when the email doesn't exist —
// don't leak account presence via timing/response.

import { z } from "zod";
import { prisma } from "#server/db/prisma";
import { userRepository } from "#server/repositories/userRepository";
import { issueToken, resolveOrigin } from "#server/utils/auth";
import { verifyEmail as verifyEmailTemplate } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";

const bodySchema = z.object({ email: z.email() });

export default defineEventHandler(async (event) => {
  const { email } = await readValidatedBody(event, bodySchema.parse);

  const user = await userRepository.getByEmail(email);
  if (!user || user.emailVerified) return { ok: true };

  // Token-table read stays inline: verification-token access isn't
  // wide enough to justify its own repository yet.
  const recent = await prisma.verificationToken.findFirst({
    where: { userId: user.id, purpose: "email_verify" },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
    return { ok: true };
  }

  const token = await issueToken(user.id, "email_verify");
  const { subject, html } = verifyEmailTemplate(resolveOrigin(event), token);
  await mailClient.send([user.email], subject, html);
  return { ok: true };
});
