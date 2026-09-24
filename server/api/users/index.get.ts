// Admin-only listing of every user for the /users management page.
// The repository already returns the client-safe shape.

import { userRepository } from "#server/repositories/userRepository";
import { requireAdmin } from "#server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return await userRepository.getAll();
});
