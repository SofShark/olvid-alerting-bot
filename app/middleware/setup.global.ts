// First-run redirect. If the deploy has no admin yet, every route
// except /setup itself funnels there. Creating an initial admin account 
// will require knowledge of the ADMIN_KEY from .env.
//
// Caching: only cache the terminal `false` (setup done) — that state
// is one-way and stable.

let doneCached = false;
let inflight: Promise<boolean> | null = null;

async function getNeedsSetup(): Promise<boolean> {
  if (doneCached) return false;
  if (inflight) return inflight;
  inflight = $fetch<{ needsSetup: boolean }>("/api/auth/status")
    .then((r) => {
      if (!r.needsSetup) doneCached = true;
      return r.needsSetup;
    })
    .catch(() => false)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/setup") return;
  const needs = await getNeedsSetup();
  if (needs) return navigateTo("/setup");
});
