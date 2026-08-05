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
} from "#shared/types/auth";
import type { User } from "#shared/types/user";

export const authService = {
  login(credentials: CredentialsForm): Promise<{ user: User }> {
    return $fetch("/api/auth/login", { method: "POST", body: credentials });
  },

  logout(): Promise<unknown> {
    return $fetch("/api/auth/logout", { method: "POST" });
  },

  status(): Promise<AuthStatus> {
    return $fetch<AuthStatus>("/api/auth/status");
  },

  setup(body: SetupForm): Promise<{ requiresVerification: boolean }> {
    return $fetch("/api/auth/setup", { method: "POST", body });
  },

  verifyEmail(token: string): Promise<unknown> {
    return $fetch("/api/auth/verify-email", {
      method: "POST",
      body: { token },
    });
  },

  resendVerification(email: string): Promise<{ ok: true }> {
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
   * returns 400 on invalid / expired / used tokens — callers that want
   * graceful degradation should catch and treat as "unknown invitee".
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
