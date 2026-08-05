// Consumes an invite token, sets the user's password, activates the
// account (the link travelled through their inbox or clipboard), and
// logs them in. Name / login / role are locked in by the admin at
// invite time — the invited user only chooses their password.
//
// Password hashing runs BEFORE authService.acceptInvite so argon2's
// CPU work doesn't sit inside a DB transaction. The service then
// consumes the token and activates the user atomically — if the DB
// write fails, the token stays unused and the invitee can retry.

import { z } from "zod";
import { authService } from "#server/services/authService";
import { toClientUser } from "#server/utils/auth";
import { readBodyOr400 } from "#server/utils/httpError";
import type { AcceptInviteForm } from "#shared/types/auth";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
}) satisfies z.ZodType<AcceptInviteForm>;

export default defineEventHandler(async (event) => {
  const { token, password } = await readBodyOr400(event, bodySchema);
  const passwordHash = await hashPassword(password);
  const updated = await authService.acceptInvite(token, passwordHash);
  await setUserSession(event, { user: toClientUser(updated) });
  return { user: toClientUser(updated) };
});
