// Olvid daemon *listener* — a second connection dedicated to receiving
// notifications from the daemon (discussion created, title updated, …).
// The write-side lives in `olvidClient.ts`; keeping them separate lets us
// reason about the two roles independently and lets the streaming
// listener run alongside RPC calls without contention on the same client.
//
// This file has two jobs:
//   · init()          — one-time seed of olvidDiscussionRepository from
//                       whatever the daemon knows right now (discussions
//                       + photos).
//   · startUpdater()  — long-lived listener that keeps the repo in sync
//                       with subsequent daemon events.
//
// Previously the file ran `main()` at import time. That was a bug: any
// server module that imported anything from `server/clients/` also
// triggered Nitro to auto-import THIS file, and `runForever()` fired
// once per HMR reload — leaking gRPC subscriptions on the daemon.
// Fixed by exporting `startUpdater()` and having a Nitro plugin call it
// exactly once at server boot (`server/plugins/olvid-updater.ts`).

import { OlvidClient, datatypes } from "@olvid/bot-node";
import { olvidClient } from "./olvidClient";

/** Guard against a second start in dev-HMR reloads (Nitro plugins can
 *  re-run on server hot-reload; the underlying subscription would
 *  otherwise leak on the daemon side). */
let started = false;

/**
 * Seed the cache: fetch every discussion the daemon knows plus its
 * profile photo, hand each pair to olvidDiscussionRepository.
 *
 * Sequential on purpose — the daemon's gRPC channel is happier with a
 * steady drip than a parallel burst of photo fetches, and for the
 * typical desktop-scale contact list (<200 discussions) the wall-clock
 * is trivial.
 */
export async function init(): Promise<void> {
  const discussions = await olvidClient.getDiscussions();
  for (const discussion of discussions) {
    if (!discussion || !discussion.id) continue;
    try {
      const photo = await olvidClient.getDiscussionPhoto(discussion.id);
      olvidDiscussionRepository.add(discussion, photo);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `⚠️ [Olvid updater] init failed for discussion ${discussion.id}: ${msg}`,
      );
    }
  }
  console.log(
    `[Olvid updater] cache seeded: ${olvidDiscussionRepository.size().discussions} discussions, ${olvidDiscussionRepository.size().photos} photos`,
  );
}

export async function startUpdater(): Promise<void> {
  if (started) {
    console.log("[Olvid updater] already running — skipping second start");
    return;
  }
  started = true;

  // Seed the cache before wiring listeners. If we did it the other way
  // around, events arriving during init() would race against a partial
  // snapshot — updateTitle() would silently no-op on unknown ids.
  await init();

  const updater = new OlvidClient();
  console.log("[Olvid updater] client created — subscribing to events");

  updater.onDiscussionNew({
    callback: async (discussion: datatypes.Discussion) => {
      console.log(`✅ [Olvid] New discussion: ${discussion.id}`);
      olvidDiscussionRepository.addDiscussion(discussion);
      // Fetch its photo separately — onDiscussionNew doesn't carry one.
      // Skip on failure; a subsequent photo event will fill it in.
      try {
        const photo = await olvidClient.getDiscussionPhoto(discussion.id);
        if (photo) olvidDiscussionRepository.updatePhoto(discussion.id, photo);
      } catch {
        /* silent — the photo will resurface via onXxxPhotoUpdated */
      }
    },
  });

  updater.onDiscussionTitleUpdated({
    callback: (discussion: datatypes.Discussion, previousTitle: string) => {
      console.log(
        `✅ [Olvid] Title ${discussion.id}: "${previousTitle}" → "${discussion.title}"`,
      );
      olvidDiscussionRepository.updateTitle(discussion.id, discussion.title);
    },
  });

  updater.onGroupDeleted({
    callback: (group: datatypes.Group) => {
      console.log(`✅ [Olvid] Group deleted: ${group.id}`);
      olvidDiscussionRepository.remove(group.id);
    },
  });

  updater.onContactPhotoUpdated({
    callback: async (contact: datatypes.Contact) => {
      console.log(`✅ [Olvid] Contact photo updated: ${contact.id}`);
      try {
        const photo = await olvidClient.getDiscussionPhoto(contact.id);
        if (photo) olvidDiscussionRepository.updatePhoto(contact.id, photo);
      } catch {
        /* silent — cache keeps the previous photo, still better than nothing */
      }
    },
  });

  updater.onGroupPhotoUpdated({
    callback: async (group: datatypes.Group) => {
      console.log(`✅ [Olvid] Group photo updated: ${group.id}`);
      try {
        const photo = await olvidClient.getDiscussionPhoto(group.id);
        if (photo) olvidDiscussionRepository.updatePhoto(group.id, photo);
      } catch {
        /* silent — cache keeps the previous photo */
      }
    },
  });

  console.log("[Olvid updater] listening…");
  // runForever() never resolves under normal operation. If it does
  // (daemon disconnect, terminal error), reset the flag so a future
  // plugin re-run can restart cleanly.
  try {
    await updater.runForever();
  } finally {
    started = false;
  }
}
