// Registry mapping BundleOutputType → ChannelDispatcher.
//
// Same shape as `formatterFactory` / `operatorFactory` / `aggregatorFactory`:
// one file to touch when adding a new channel (Slack, Discord, …). Consumers
// receive `null` for unknown types and decide what to do (skip + warn).

import type { BundleOutput } from "#shared/types/bundle";
import type { ChannelDispatcher } from "./types";
import { olvidChannel } from "./olvidChannel";
import { mailChannel } from "./mailChannel";

const registry = new Map<BundleOutput["type"], ChannelDispatcher>([
  [olvidChannel.channel, olvidChannel],
  [mailChannel.channel, mailChannel],
]);

export const channelFactory = {
  forChannel(type: BundleOutput["type"]): ChannelDispatcher | null {
    return registry.get(type) ?? null;
  },
};
