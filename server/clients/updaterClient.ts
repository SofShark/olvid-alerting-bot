// Olvid daemon *listener* — a second connection dedicated to receiving
// notifications from the daemon (discussion created, title updated, …).
// The write-side lives in `olvidClient.ts`; keeping them separate lets us
// reason about the two roles independently and lets the streaming
// listener run alongside RPC calls without contention on the same client.
//
// Previously this file ran `main()` at import time. That was a bug: any
// server module that imported anything from `server/clients/` also
// triggered Nitro to auto-import THIS file, and `runForever()` fired
// once per HMR reload — leaking gRPC subscriptions on the daemon.
//
// Fixed by exporting `startUpdater()` and having a Nitro plugin call it
// exactly once at server boot (`server/plugins/olvid-updater.ts`).

import { OlvidClient, datatypes } from "@olvid/bot-node";
import {olvidClient} from "./olvidClient"
/** Guard against a second start in dev-HMR reloads (Nitro plugins can
 *  re-run on server hot-reload; the underlying subscription would
 *  otherwise leak on the daemon side). */
let started = false;

const discussionRepo : datatypes.Discussion[] = []

export async function init(): Promise<void> {
  const discussions = await olvidClient.getDiscussions();
  discussionRepo.push(...discussions);
}

export async function startUpdater(): Promise<void> {
  if (started) {
    console.log("[Olvid updater] already running — skipping second start");
    return;
  }
  started = true;

  // Initialisation of initial discussions on daemon
  await(init())

  const updater = new OlvidClient();
  console.log("[Olvid updater] client created — subscribing to events");
  console.log(discussionRepo.length)

  updater.onDiscussionNew({
    callback: (discussion: datatypes.Discussion) => {
      console.log(`✅ [Olvid] New discussion created: ${discussion.id}`);
    },
  });

  updater.onDiscussionTitleUpdated({
    callback: (discussion: datatypes.Discussion, previousTitle: string) => {
      console.log(
        `✅ [Olvid] Discussion ${discussion.id} title changed:\n  ${previousTitle}\n→ ${discussion.title}`,
      );
    },
  });

  updater.onGroupDeleted({
    callback: (group: datatypes.Group) => {
      console.log(
        `✅ [Olvid] Group`,
      );
    },
  });

  updater.onContactPhotoUpdated({
    callback: (contact: datatypes.Contact) => {
      console.log(
        `✅ [Olvid] Group`,
      );
    },
  });

  updater.onGroupPhotoUpdated({
    callback: (group: datatypes.Group) => {
      console.log(
        `✅ [Olvid] Group`,
      );
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
