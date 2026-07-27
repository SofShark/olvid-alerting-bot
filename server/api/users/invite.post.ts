// Admin-only user invitation. Two peer paths, distinguished by
// `sendMail`:
//
//   sendMail=true  → mail invite. Requires `email`. Login is coerced
//                    to the email. SMTP must be available or we bail
//                    (400) so the admin doesn't quietly get a dead
//                    invite.
//   sendMail=false → URL-copy invite. Requires `login` (username).
//                    Email may be null. No SMTP needed.
//
// Response always includes { user, inviteUrl, mailed } so the /users
// modal can offer a "Copy link" affordance in either path.

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
import type { InviteResponse, InviteUserForm } from "#shared/types/auth";

const bodySchema = z
  .object({
    login: z.string().trim().min(1).optional(),
    email: z.email().optional(),
    name: z.string().trim().min(1).optional(),
    role: z.enum(["admin", "user"]),
    sendMail: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.login || b.email), {
    message: "invite_needs_identifier",
  }) satisfies z.ZodType<InviteUserForm>;

export default defineEventHandler(async (event): Promise<InviteResponse> => {
  const session = await requireAdmin(event);
  const body = await readValidatedBody(event, bodySchema.parse);
  const sendMail = body.sendMail ?? true;

  if (sendMail) {
    if (!body.email) {
      throw createError({ statusCode: 400, statusMessage: "email_required" });
    }
    if (!mailClient.isAvailable()) {
      throw createError({ statusCode: 400, statusMessage: "mail_not_configured" });
    }
  }

  const login = (sendMail ? body.email : body.login ?? body.email)!;
  const email = body.email ?? null;

  // Reuse an existing pending row if the same login/email was invited
  // before but never accepted; refuse to clobber an activated account.
  let user =
    (await userRepository.getByLogin(login)) ??
    (email ? await userRepository.getByEmail(email) : null);
  if (user && user.passwordHash) {
    throw createError({ statusCode: 409, statusMessage: "user_already_active" });
  }
  if (!user) {
    user = await userRepository.create({
      login,
      email,
      role: body.role,
      name: body.name ?? null,
    });
  }

  const token = await issueToken(user.id, "invite");
  const inviteUrl = `${resolveOrigin(event)}/invite?token=${encodeURIComponent(token)}`;

  let mailed = false;
  if (sendMail && email) {
    const inviter = session.user.name ?? session.user.login;
    const { subject, html } = inviteEmail(resolveOrigin(event), token, inviter);
    mailed = await mailClient.send([email], subject, html);
  }

  return { user: toClientUser(user), inviteUrl, mailed };
});
