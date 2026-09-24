// Olvid daemon listener
// The write-side lives in `olvidClient.ts`

// Two jobs:
//   · init()          — one-time on-boot population of olvidDiscussionRepository from
//                       current context (discussions + photos).
//   · startUpdater()  — long-lived listener that keeps the repo in sync
//                       with subsequent daemon events.
//
// A Nitro plugin calls main() and startUpdater()exactly once at server boot (`server/plugins/olvid-updater.ts`).

import { OlvidClient, datatypes } from "@olvid/bot-node";
import { olvidClient } from "./olvidClient";


function toModel(d: datatypes.Discussion): DiscussionModel {
  const isGroup = d.identifier?.case === "groupId";
  return {
    id: String(d.id),
    title: d.title + (isGroup ? " (group)" : ""),
    kind: isGroup ? "group" : "contact",
    // Photo lives in the parallel `photosById` map. listModels() inlines
    // it as a data URL on read — the row itself carries no bytes.
    photoDataUrl: null,
  };
}



export async function init(): Promise<void> {
  const discussions = await olvidClient.getDiscussions();
  for (const discussion of discussions) {
    if (!discussion || !discussion.id) continue;
    try {
      const photo = await olvidClient.getDiscussionPhoto(discussion.id);
      olvidDiscussionRepository.add(toModel(discussion), photo);
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

/** Guard against a second start in dev-HMR reloads (Nitro plugins can
 *  re-run on server hot-reload; the underlying subscription would
 *  otherwise leak on the daemon side). */
let started = false;

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
      
      // Try to load photo now, if it fails — the photo will resurface via onXxxPhotoUpdated.
      let photo = null
      try {
        photo = await olvidClient.getDiscussionPhoto(discussion.id);
      } catch {
      }
      olvidDiscussionRepository.add(toModel(discussion), photo);
    },
  });

  updater.onDiscussionTitleUpdated({
    callback: (discussion: datatypes.Discussion, previousTitle: string) => {
      console.log(
        `✅ [Olvid] Title ${discussion.id}: "${previousTitle}" → "${discussion.title}"`,
      );
      olvidDiscussionRepository.updateTitle(discussion.id.toString(), discussion.title);
    },
  });

  updater.onGroupDeleted({
    callback: (group: datatypes.Group) => {
      console.log(`✅ [Olvid] Group deleted: ${group.id}`);
      olvidDiscussionRepository.remove(group.id.toString());
    },
  });

  updater.onContactPhotoUpdated({
    callback: async (contact: datatypes.Contact) => {
      console.log(`✅ [Olvid] Contact photo updated: ${contact.id}`);
      try {
        const photo = await olvidClient.getDiscussionPhoto(contact.id);
        if (photo) olvidDiscussionRepository.updatePhoto(contact.id.toString(), photo);
      } catch {
        /* silent — cache keeps the previous photo */
      }
    },
  });

  updater.onGroupPhotoUpdated({
    callback: async (group: datatypes.Group) => {
      console.log(`✅ [Olvid] Group photo updated: ${group.id}`);
      try {
        const photo = await olvidClient.getDiscussionPhoto(group.id);
        if (photo) olvidDiscussionRepository.updatePhoto(group.id.toString(), photo);
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
