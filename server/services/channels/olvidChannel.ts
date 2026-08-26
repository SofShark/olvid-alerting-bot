// Olvid channel strategy.
//
// Recipients arrive as OlvidOutputParams (stringified bigint ids). Anything
// non-parseable is warned + skipped rather than throwing, so one bad row
// can't take down a bundle's send. Olvid renders markdown natively — the
// message is passed through verbatim (matches the preview split).

import { BundleOutputType, type OlvidOutputParams } from "#shared/types/bundle";
import type { ChannelReport } from "#shared/types/dispatchStrategy";
import { olvidClient } from "../../clients/olvidClient";
import type { ChannelDispatcher } from "./types";

export const olvidChannel: ChannelDispatcher = {
  channel: BundleOutputType.Olvid,

  async dispatch(outputs, ctx): Promise<ChannelReport | null> {
    const discussions: bigint[] = [];
    for (const output of outputs) {
      if (output.type !== BundleOutputType.Olvid) continue;
      const raw = (output.params as OlvidOutputParams)?.discussionId;
      if (raw === null || raw === undefined) continue;
      try {
        discussions.push(BigInt(raw));
      } catch {
        console.warn(
          `⚠️ Bundle #${ctx.bundle.id}: invalid Olvid discussionId ${JSON.stringify(raw)}`,
        );
      }
    }
    if (discussions.length === 0) return null;

    const ok = await olvidClient.sendMessage(discussions, ctx.message);
    return {
      channel: BundleOutputType.Olvid,
      ok,
      recipients: discussions.length,
      error: ok ? undefined : "Olvid daemon reported a send failure",
    };
  },
};
