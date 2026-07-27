// Client-facing User shape. Nothing sensitive (no passwordHash, no
// DB timestamps).
//
// `login` is the identifier the user types at sign-in — always present.
// `email` is delivery-only and may be null when the account was created
// without SMTP (the admin picked a plain username as the login).
export type UserRole = "admin" | "user";

export interface User {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  // `activated` — has the account been used at least once (setup form
  // completed, invite accepted, or email verified). Renders as "Active"
  // in the users table; pending users still need to open their invite.
  activated: boolean;
}
