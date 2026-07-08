// Factory: alert Source → dispatch strategy.
//
// This is THE single place in the server that branches on Source for
// dispatch purposes. Adding a new scheduled source =
//   1. write its strategy file in this folder,
//   2. add one case below.
// Nothing else changes (OCP) — the dispatcher, heartbeat and repository
// stay untouched.
//
// Webhook intentionally returns null: it is push-driven and never flows
// through the heartbeat → dispatcher path.

import type { DispatchStrategy } from "#shared/types/dispatchStrategy";
import { Source } from "#shared/types/source";

export const dispatcherFactory = {
  forSource(source: string | undefined | null): DispatchStrategy | null {
    switch (source) {
      case Source.Polling:
        return pollingStrategy;
      case Source.Monitoring:
        return monitoringStrategy;
      default:
        return null;
    }
  },
};
