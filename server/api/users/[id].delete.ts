// Admin-only user deletion. Two hard rules:
//   1. You cannot delete yourself (would evict the current session and
//      lock you out mid-request).
//   2. You cannot delete the last admin (would leave the deploy with no
//      way back into /users).

import { userRepository } from "#server/repositories/userRepository";
import { requireAdmin } from "#server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "bad_id" });
  }
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

  await userRepository.deleteById(id);
  return { ok: true };
});
