// Client-facing User shape. Everything the browser is allowed to know
// about a user — no password hash, no DB timestamps.
export type UserRole = "admin" | "user";

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
}
