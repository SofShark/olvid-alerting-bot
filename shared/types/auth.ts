// Request/response shapes for auth endpoints. Only forms that back a
// v-model on the client get a named interface — single-field payloads
// like { token } or { email } are inlined at the call site.
import type { User, UserRole } from "./user";

// The sign-in form. `login` accepts either an email address or a plain
// username, depending on how the account was created.
export interface CredentialsForm {
  login: string;
  password: string;
}

// First-run admin setup. `adminKey` must match the ADMIN_KEY env var
// — it's how the operator proves they control the deploy. `email` is
// optional so the deploy can boot without SMTP configured; when
// supplied it enables the verification-email path.
export interface SetupForm {
  adminKey: string;
  login: string;
  email?: string;
  password: string;
  name?: string;
}

export interface AcceptInviteForm {
  token: string;
  password: string;
  name?: string;
}

// The invite modal has two peer paths:
//   - Mail path: admin supplies an email, backend fires SMTP.
//   - URL path: admin supplies a login (username), backend just mints
//     the token and returns the URL for manual sharing.
// Backend requires exactly one identifier + role. `sendMail` controls
// which side-effect runs; defaults to true when omitted.
export interface InviteUserForm {
  login?: string;
  email?: string;
  name?: string;
  role: UserRole;
  sendMail?: boolean;
}

// Server response for POST /users/invite and /resend-invite. The URL
// is always included so the admin can copy it out-of-band regardless
// of whether the mail was sent.
export interface InviteResponse {
  user: User;
  inviteUrl: string;
  mailed: boolean;
}

// Server response for GET /api/auth/status. `mailEnabled` is derived
// once at boot from the SMTP env vars — the client uses it to gate
// every mail-related UI surface.
export interface AuthStatus {
  needsSetup: boolean;
  mailEnabled: boolean;
}

