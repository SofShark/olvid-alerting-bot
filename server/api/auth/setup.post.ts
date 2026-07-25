// First-run only: creates the very first admin account. 409 if any
// admin already exists — protects against a bad actor hitting /setup
// after deployment. Does NOT log the user in — they must click the
// verification email first (so a typo in the email is caught before
// the account is usable).

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { issueToken, resolveOrigin } from "#server/utils/auth";
import { verifyEmail as verifyEmailTemplate } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";
import type { SetupForm } from "#shared/types/auth";

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
}) satisfies z.ZodType<SetupForm>;

export default defineEventHandler(async (event) => {
  const { email, password, name } = await readValidatedBody(
    event,
    bodySchema.parse,
  );

  if (await userRepository.findFirstAdmin()) {
    throw createError({ statusCode: 409, statusMessage: "Setup already complete" });
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({
    email,
    passwordHash,
    name: name ?? null,
    role: "admin",
    emailVerified: null,
  });

  const token = await issueToken(user.id, "email_verify");
  const { subject, html } = verifyEmailTemplate(resolveOrigin(event), token);
  await mailClient.send([user.email], subject, html);

  return { ok: true };
});
