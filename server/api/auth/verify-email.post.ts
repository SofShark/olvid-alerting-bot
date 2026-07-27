// Consumes an email_verify token and marks the user's email as verified.
// One-shot; the token cannot be replayed.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { consumeToken } from "#server/utils/auth";

const bodySchema = z.object({ token: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const { token } = await readValidatedBody(event, bodySchema.parse);
  const userId = await consumeToken(token, "email_verify");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "token_invalid" });
  }
  await userRepository.update(userId, { activatedAt: new Date() });
  return { ok: true };
});
