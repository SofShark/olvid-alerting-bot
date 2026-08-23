// Client-side gateway for /api/auth/* endpoints. Vue pages/components
// never call these routes with $fetch directly — the service is the
// one and only place the API surface is spelled out. A route rename or
// body-shape change fans out from here through named methods, not
// through a grep-and-replace across .vue files.
//
// Errors are propagated unchanged (H3-shaped { statusCode, statusMessage })
// so the calling page can switch on statusMessage for its own copy.

import type {
  AcceptInviteForm,
  AuthStatus,
  CredentialsForm,
  RequestPasswordResetResponse,
  ResetPasswordForm,
  SetupForm,
  SetupResponse,
} from "#shared/types/auth";
import type { DiscussionModel } from "#shared/types/discussion";
import type { User } from "#shared/types/user";

export const authService = {
  login(credentials: CredentialsForm): Promise<{ user: User }> {
    return $fetch<{ user: User }>("/api/auth/login", { method: "POST", body: credentials });
  },

  logout(): Promise<unknown> {
    return $fetch("/api/auth/logout", { method: "POST" });
  },

  status(): Promise<AuthStatus> {
    return $fetch<AuthStatus>("/api/auth/status");
  },

  /**
   * Validate the admin key WITHOUT creating any user. Backs the
   * step-1 gate of the /setup UI. Throws 401 invalid_admin_key /
   * 409 setup_already_complete / 503 admin_key_not_configured
   * exactly like the full setup call, so the caller can reuse its
   * error map.
   */
  verifySetupKey(adminKey: string): Promise<{ ok: true }> {
    return $fetch("/api/auth/setup/verify-key", {
      method: "POST",
      body: { adminKey },
    });
  },

  /**
   * Fetch the Olvid discussion list during setup — same payload as
   * GET /api/discussions but gated by the admin key rather than a
   * session cookie (the first admin has no session yet). Same 401 /
   * 409 shape as verifySetupKey.
   */
  setupDiscussions(adminKey: string): Promise<DiscussionModel[]> {
    return $fetch("/api/auth/setup/discussions", {
      method: "POST",
      body: { adminKey },
    });
  },

  /**
   * Create the first admin as a pending invited user and dispatch the
   * activation URL through the picked channel (mail / olvid / link).
   * Response echoes the URL so the client can reveal it — same UX as
   * an admin issuing an invite for anyone else.
   */
  setup(body: SetupForm): Promise<SetupResponse> {
    return $fetch("/api/auth/setup", { method: "POST", body });
  },

  verifyEmail(token: string): Promise<unknown> {
    return $fetch("/api/auth/verify-email", {
      method: "POST",
      body: { token },
    });
  },

  resendVerification(email: string): Promise<boolean> {
    return $fetch("/api/auth/resend-verification", {
      method: "POST",
      body: { email },
    });
  },

  acceptInvite(payload: AcceptInviteForm): Promise<{ user: User }> {
    return $fetch("/api/auth/accept-invite", { method: "POST", body: payload });
  },

  /**
   * Peek the invitee's login/name without consuming the token. Endpoint
   * returns 400/404 on invalid / expired / used tokens — callers should
   * catch those two statuses and surface "invitation invalid or expired".
   */
  peekInvite(token: string): Promise<{ login: string; name: string | null }> {
    return $fetch("/api/auth/invite-info", { query: { token } });
  },

  /**
   * Kick off a password reset. Response tells the caller which channel
   * the server used ("olvid" / "mail" / "none"); the UI switches on it
   * to render "check your Olvid" / "check your mail" / "contact your
   * admin". Never leaks whether the login exists.
   */
  requestPasswordReset(login: string): Promise<RequestPasswordResetResponse> {
    return $fetch("/api/auth/request-password-reset", {
      method: "POST",
      body: { login },
    });
  },

  /**
   * Peek a password-reset token to confirm which account it targets.
   * Same shape and error contract as `peekInvite`.
   */
  peekReset(token: string): Promise<{ login: string; name: string | null }> {
    return $fetch("/api/auth/reset-info", { query: { token } });
  },

  /**
   * Consume a password-reset token, set the new password, and open a
   * fresh session. Same contract as `acceptInvite` — 400 token_invalid
   * on any invalid state.
   */
  resetPassword(payload: ResetPasswordForm): Promise<{ user: User }> {
    return $fetch("/api/auth/reset-password", {
      method: "POST",
      body: payload,
    });
  },
};

export const AUTH_ENDPOINTS = {
  inviteInfo: "/api/auth/invite-info",
  resetInfo: "/api/auth/reset-info",
} as const;
