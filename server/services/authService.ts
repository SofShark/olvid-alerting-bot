// Auth business rules — the pieces of the auth flow that need
// coordination beyond a single repository method. Endpoints stay thin:
// they parse input and delegate here.
//
// The atomic "consume token + apply user-side side-effect" writes live
// in authRepository (that's where prisma access belongs). This layer
// translates repository nulls into H3-shaped errors so endpoints can
// re-throw them unchanged.

import { authRepository } from "#server/repositories/authRepository";
import type { User as PrismaUser } from "@prisma/client";

export const authService = {
  /**
   * Consume an invite token and activate the owning user with the given
   * (already-hashed) password. Throws a 400 token_invalid on any token
   * failure (unknown / wrong purpose / expired / already used).
   */
  async acceptInvite(
    rawToken: string,
    passwordHash: string,
  ): Promise<PrismaUser> {
    const user = await authRepository.acceptInvite(rawToken, passwordHash);
    if (!user) {
      throw createError({ statusCode: 400, statusMessage: "token_invalid" });
    }
    return user;
  },

  /**
   * Consume a password-reset token and set the owning user's password.
   * Same throw semantics as acceptInvite; differs only in that the
   * user is already activated (no activatedAt stamp).
   */
  async resetPassword(
    rawToken: string,
    passwordHash: string,
  ): Promise<PrismaUser> {
    const user = await authRepository.resetPassword(rawToken, passwordHash);
    if (!user) {
      throw createError({ statusCode: 400, statusMessage: "token_invalid" });
    }
    return user;
  },
};
