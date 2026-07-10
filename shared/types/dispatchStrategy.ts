// Contract for a source-specific dispatch strategy (Strategy pattern).
//
// Each alert Source that runs on the heartbeat (Polling, Monitoring, …)
// ships one object implementing this interface. The dispatcher stays
// source-agnostic: it asks the factory for the right strategy, runs
// `execute`, then handles the COMMON tail itself (persist runtime state
// + append the outcome to the AlertLog).
//
// Split rationale: "how the fire/no-fire boolean is produced" varies per
// source; "what happens around it" (state persistence, logging, error
// containment) does not. The strategy owns only the varying part.

import type { AlertModel } from "./alert";

export type DispatchOutcome = {
  status: "success" | "warning" | "error";
  error: string | null;
};

export type DispatchResult = {
  /** What to record in the AlertLog for this run. */
  outcome: DispatchOutcome;
  /** Runtime-state fields to merge into `alertParams` (e.g. `_lastFired`,
   *  `_baseline`, `_lastStatus`). The dispatcher stamps `_lastPolledAt`
   *  itself, so strategies never need to. */
  paramsPatch: Record<string, unknown>;
};

export interface DispatchStrategy {
  /** Run the source-specific probe → evaluate → decide → notify chain.
   *  Should only throw on truly unexpected errors — anticipated failures
   *  (network down, bad config) are reported through `outcome`. */
  execute(alert: AlertModel): Promise<DispatchResult>;
}
