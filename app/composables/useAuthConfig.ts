import type { AuthStatus } from "#shared/types/auth";

// Single reactive source for /api/auth/status. Every page that needs
// to know "should the mail UI show?" reads from this — one network hop
// per session, kept in useAsyncData's cache so subsequent callers get
// the value synchronously.
//
// `refresh()` is exposed so /setup can re-check after creating the
// first admin (the needsSetup flag flips permanently at that point).
export const useAuthConfig = () => {
  return useAsyncData<AuthStatus>(
    "auth-config",
    () => $fetch<AuthStatus>("/api/auth/status"),
    { default: () => ({ needsSetup: false, mailEnabled: false }) },
  );
};
