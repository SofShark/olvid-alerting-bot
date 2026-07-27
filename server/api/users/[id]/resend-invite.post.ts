// Admin-only: reissue an invite token for a user whose account was
// created but never activated (passwordHash is still null). Refuses on
// already-active accounts — those need a password-reset flow, not an
// invite.
//
// Delivery follows the row's own shape: if the user has an email and
// SMTP is available, we fire the mail; otherwise we still mint a fresh
// token and return the URL for the admin to copy.

import { userRepository } from "#server/repositories/userRepository";
import { issueToken, requireAdmin, resolveOrigin, toClientUser } from "#server/utils/auth";
import { inviteEmail } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";
import type { InviteResponse } from "#shared/types/auth";

export default defineEventHandler(async (event): Promise<InviteResponse> => {
  const session = await requireAdmin(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "bad_id" });
  }
  const user = await userRepository.getById(id);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "not_found" });
  }
  if (user.passwordHash) {
    throw createError({ statusCode: 400, statusMessage: "user_already_active" });
  }

  const token = await issueToken(user.id, "invite");
  const inviteUrl = `${resolveOrigin(event)}/invite?token=${encodeURIComponent(token)}`;

  let mailed = false;
  if (user.email && mailClient.isAvailable()) {
    const inviter = session.user.name ?? session.user.login;
    const { subject, html } = inviteEmail(resolveOrigin(event), token, inviter);
    mailed = await mailClient.send([user.email], subject, html);
  }

  return { user: toClientUser(user), inviteUrl, mailed };
});
