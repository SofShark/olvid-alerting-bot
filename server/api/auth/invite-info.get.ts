// Peek at an invite token WITHOUT consuming it. Used by the
// accept-invite page to show the invitee which account they're
// activating (login + optional name), so they see e.g. "Set a
// password to activate your account with login alice".
//
// The token is only marked used by POST /api/auth/accept-invite
// after they submit their password. Returning 400 on invalid /
// expired / already-used tokens lets the page render an error
// state without leaking why.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { peekToken } from "#server/utils/auth";
import type { User } from "#shared/types/user";

const querySchema = z.object({ token: z.string().min(1) });

export default defineEventHandler(async (event): Promise<Pick<User, "login" | "name">> => {
  const { token } = await getValidatedQuery(event, querySchema.parse);
  const userId = await peekToken(token, "invite");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "token_invalid" });
  }
  const user = await userRepository.getById(userId);
  if (!user) {
    throw createError({ statusCode: 400, statusMessage: "token_invalid" });
  }
  return { login: user.login, name: user.name };
});
