// List every Olvid discussion the daemon knows about. Reads from the
// in-process cache (olvidDiscussionRepository) seeded and kept live by
// server/plugins/olvid-updater.ts, so this handler never talks to the
// daemon on the request path.

import type { DiscussionModel } from "#shared/types/discussion";

export default defineEventHandler(
  async (event): Promise<DiscussionModel[]> => {
    await requireUserSession(event);
    return olvidDiscussionRepository.listModels();
  },
);
