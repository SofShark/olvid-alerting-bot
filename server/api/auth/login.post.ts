// Password login. 401 for both wrong-password AND unknown-login so we
// don't leak account existence. Verified-email is enforced only when
// the user has an email on file — URL-invited users get their
// activatedAt flipped on invite acceptance, so this still works for
// them too (the flag doubles as "account activated").

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { toClientUser } from "#server/utils/auth";
import type { CredentialsForm } from "#shared/types/auth";

const bodySchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
}) satisfies z.ZodType<CredentialsForm>;

export default defineEventHandler(async (event) => {
  const { login, password } = await readValidatedBody(event, bodySchema.parse);

  const user = await userRepository.getByLogin(login);
  const invalid = () =>
    createError({ statusCode: 401, statusMessage: "invalid_credentials" });

  if (!user || !user.passwordHash) throw invalid();

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw invalid();

  if (!user.activatedAt) {
    throw createError({ statusCode: 403, statusMessage: "account_not_activated" });
  }

  await setUserSession(event, { user: toClientUser(user) });
  return { user: toClientUser(user) };
});
