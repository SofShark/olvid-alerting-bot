// Boots the Olvid daemon event listener exactly once, at Nitro server
// start. Previously `server/clients/updaterClient.ts` did this at import
// time (via a top-level `main()` call), which leaked gRPC subscriptions
// on every dev-HMR reload and blocked any importer of that folder.
//
// A Nitro plugin is the right home: it runs once when the server boots,
// survives for the process lifetime, and doesn't couple to any specific
// route handler.

import { startUpdater } from "../clients/updaterClient";

export default defineNitroPlugin(() => {
  // Fire-and-forget — startUpdater() awaits `runForever()` which never
  // resolves. Awaiting it here would block plugin initialization and
  // stall the server. Errors bubble to console.
  startUpdater().catch((err) => {
    console.error("[Olvid updater] fatal:", err);
  });
});
