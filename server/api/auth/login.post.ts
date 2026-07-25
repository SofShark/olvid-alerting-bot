// Password login. 401 for both "wrong password" and "unknown email" so
// we don't leak account existence. Verified-email is enforced here —
// clients that need to re-trigger the verification email should read
// the `statusMessage` and offer a "resend" affordance.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { toClientUser } from "#server/utils/auth";
import type { CredentialsForm } from "#shared/types/auth";

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
}) satisfies z.ZodType<CredentialsForm>;

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse);

  const user = await userRepository.getByEmail(email);
  const invalid = () =>
    createError({ statusCode: 401, statusMessage: "invalid_credentials" });

  if (!user || !user.passwordHash) throw invalid();

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw invalid();

  if (!user.emailVerified) {
    throw createError({ statusCode: 403, statusMessage: "email_not_verified" });
  }

  await setUserSession(event, { user: toClientUser(user) });
  return { user: toClientUser(user) };
});
