// Admin-only: create an unverified user with no password and email
// them an invite link. If the email row exists but was never activated
// we reuse it and just reissue the token — makes "invite again"
// idempotent from an admin's point of view.

import { z } from "zod";
import { userRepository } from "#server/repositories/userRepository";
import {
  issueToken,
  requireAdmin,
  resolveOrigin,
  toClientUser,
} from "#server/utils/auth";
import { inviteEmail } from "#server/utils/authEmails";
import { mailClient } from "#server/clients/mailClient";
import type { InviteUserForm } from "#shared/types/auth";

const bodySchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "user"]),
}) satisfies z.ZodType<InviteUserForm>;

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const { email, role } = await readValidatedBody(event, bodySchema.parse);

  let user = await userRepository.getByEmail(email);
  if (user && user.passwordHash) {
    throw createError({ statusCode: 409, statusMessage: "user_already_active" });
  }
  if (!user) {
    user = await userRepository.create({ email, role });
  }

  const token = await issueToken(user.id, "invite");
  const inviter = session.user.name ?? session.user.email;
  const { subject, html } = inviteEmail(resolveOrigin(event), token, inviter);
  await mailClient.send([user.email], subject, html);

  return toClientUser(user);
});
