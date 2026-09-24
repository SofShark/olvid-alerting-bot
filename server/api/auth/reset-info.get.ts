// Peek at a password-reset token WITHOUT consuming it. Used by the
// /reset-password page to surface which account is being reset so the
// user has confidence the link matches their identity (login shown
// alongside the password field).
//
// Parallel to invite-info.get.ts but with purpose="password_reset".
// Returns 400 token_invalid on any invalid state — the caller renders
// a "link expired" message and steers the user back to /login.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import { peekToken } from "#server/utils/auth";
import type { User } from "#shared/types/user";

const querySchema = z.object({ token: z.string().min(1) });

export default defineEventHandler(
  async (event): Promise<Pick<User, "login" | "name">> => {
    const { token } = await getValidatedQuery(event, querySchema.parse);
    const userId = await peekToken(token, "password_reset");
    if (!userId) {
      throw createError({ statusCode: 400, statusMessage: "token_invalid" });
    }
    const user = await userRepository.getById(userId);
    if (!user) {
      throw createError({ statusCode: 400, statusMessage: "token_invalid" });
    }
    return { login: user.login, name: user.name };
  },
);
