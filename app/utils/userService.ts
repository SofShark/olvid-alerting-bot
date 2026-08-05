// Client-side gateway for /api/users/* admin endpoints. Same rule as
// authService: no `$fetch` in components/pages — everything goes through
// a named method here so the API surface has exactly one call site per
// route.

import type { InviteResponse, InviteUserForm } from "#shared/types/auth";
import type { User } from "#shared/types/user";

export const userService = {
  list(): Promise<User[]> {
    return $fetch<User[]>("/api/users");
  },

  invite(body: InviteUserForm): Promise<InviteResponse> {
    return $fetch("/api/users/invite", { method: "POST", body });
  },

  resendInvite(id: number): Promise<InviteResponse> {
    return $fetch(`/api/users/${id}/resend-invite`, { method: "POST" });
  },

  updateName(id: number, name: string | null): Promise<User> {
    return $fetch(`/api/users/${id}`, { method: "PATCH", body: { name } });
  },

  remove(id: number): Promise<{ ok: true }> {
    return $fetch(`/api/users/${id}`, { method: "DELETE" });
  },
};
