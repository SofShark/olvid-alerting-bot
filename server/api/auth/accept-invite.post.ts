// Consumes an invite token, sets the user's password + optional name,
// marks their email verified (the token traveled through their inbox),
// and logs them in.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { consumeToken, toClientUser } from "#server/utils/auth";
import type { AcceptInviteForm } from "#shared/types/auth";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
}) satisfies z.ZodType<AcceptInviteForm>;

export default defineEventHandler(async (event) => {
  const { token, password, name } = await readValidatedBody(
    event,
    bodySchema.parse,
  );

  const userId = await consumeToken(token, "invite");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "token_invalid" });
  }

  const current = await userRepository.getById(userId);
  if (!current) {
    throw createError({ statusCode: 400, statusMessage: "token_invalid" });
  }

  const passwordHash = await hashPassword(password);
  const updated = await userRepository.update(userId, {
    passwordHash,
    name: name ?? current.name,
    emailVerified: current.emailVerified ?? new Date(),
  });

  await setUserSession(event, { user: toClientUser(updated) });
  return { user: toClientUser(updated) };
});
