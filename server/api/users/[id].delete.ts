// Admin-only user deletion. Two hard rules:
//   1. You cannot delete yourself (would evict the current session and
//      lock you out mid-request).
//   2. You cannot delete the last admin (would leave the deploy with no
//      way back into /users).
//
// Side-effect: when the target is still pending (no passwordHash) and
// their invite was delivered through Olvid, we revoke the outbound DM
// so a dead link doesn't linger in the invitee's chat. Best-effort —
// a daemon failure here mustn't block the actual row deletion.

import { userRepository } from "#server/repositories/userRepository";
import { readTargetUserId, requireAdmin } from "#server/utils/auth";
import { toHttpError } from "#server/utils/httpError";
import { olvidClient } from "#server/clients/olvidClient";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const id = readTargetUserId(event);
  if (id === session.user.id) {
    throw createError({ statusCode: 400, statusMessage: "cannot_delete_self" });
  }

  const target = await userRepository.getById(id);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "not_found" });
  }
  if (target.role === "admin" && (await userRepository.countAdmins()) <= 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "cannot_delete_last_admin",
    });
  }

  // Revoke a pending Olvid invite DM before the row disappears.
  // Guarded on `!passwordHash` so we never delete a message from an
  // already-activated user's chat history — once activated the invite
  // has served its purpose and the message shouldn't be tampered with.
  if (!target.passwordHash && target.inviteOlvidMessageId != null) {
    await olvidClient.deleteOutboundMessage(target.inviteOlvidMessageId);
  }

  try {
    await userRepository.deleteById(id);
    return { ok: true };
  } catch (error) {
    throw toHttpError(error, `DELETE /api/users/${id}`);
  }
});
