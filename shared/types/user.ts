// Client-facing User shape.
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
  // Has the account been actjvated. Pending users still need to open their invite.
  activated: boolean;
}
