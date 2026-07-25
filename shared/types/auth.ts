// Request-body shapes for auth endpoints. Only forms that back a
// v-model on the client get a named interface — single-field payloads
// like { token } or { email } are inlined at the call site.
import type { UserRole } from "./user";

export interface CredentialsForm {
  email: string;
  password: string;
}

export interface SetupForm extends CredentialsForm {
  name?: string;
}

export interface AcceptInviteForm {
  token: string;
  password: string;
  name?: string;
}

export interface InviteUserForm {
  email: string;
  role: UserRole;
}
