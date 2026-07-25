// Admin-only: reissue an invite token for a user whose account was
// created but never activated (passwordHash is still null). Refuses on
// already-active accounts — those need a password-reset flow, not an
// invite.

import { userRepository } from "#server/repositories/userRepository";
import { issueToken, requireAdmin, resolveOrigin } from "#server/utils/auth";
import { inviteEmail } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";

export default defineEventHandler(async (event) => {
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
  const inviter = session.user.name ?? session.user.email;
  const { subject, html } = inviteEmail(resolveOrigin(event), token, inviter);
  await mailClient.send([user.email], subject, html);
  return { ok: true };
});
