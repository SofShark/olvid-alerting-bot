// Scheduled-source heartbeat. Fires every minute via Nitro's
// scheduled-tasks system. The registered task name is derived from this
// file's path under `server/tasks/` (using `:` as the directory
// separator), so this file at `server/tasks/polling/heartbeat.ts`
// becomes `polling:heartbeat`. `nuxt.config.ts` references that exact
// name in `nitro.scheduledTasks`.
//
// Responsibility split:
//   - heartbeat (this file)  → who + when. Reads all active scheduled
//                              alerts (Polling + Monitoring), filters by
//                              cron dueness, hands each due alert off to
//                              the dispatcher.
//   - pollingDispatcher      → how. Runs the source-specific probe,
//                              decides fire/no-fire, notifies, persists
//                              runtime state, writes the log.
//
// This file stays minimal on purpose — the pipeline is somewhere else,
// so a scheduling problem never gets confused with a probe-execution
// problem.
//
// The task keeps the `polling:heartbeat` name for backwards compat with
// nuxt.config, even though Monitoring alerts also flow through it.

import { defineTask } from "nitropack/runtime";
import type { AlertModel } from "#shared/types/alert";
import { scheduler } from "#shared/polling/scheduler";

/** Both PollingParams and MonitorParams carry a cron `schedule` string
 *  and a `_lastPolledAt` epoch — the only two fields the heartbeat
 *  actually reads. Kept structural so callers don't have to widen. */
type ScheduledParams = { schedule?: string; _lastPolledAt?: number };

export default defineTask({
  meta: {
    name: "polling:heartbeat", // must match the key in nuxt.config's scheduledTasks
    description: "Heartbeat — dispatches every scheduled alert that's due",
  },
  async run() {
    const due = await collectDueAlerts();
    console.log(`[polling:heartbeat] ${due.length} alert(s) due`);
    const results = await Promise.allSettled(
      due.map((alert) => pollingDispatcher.dispatch(alert)),
    );
    return { result: { polled: results.length } };
  },
});

/**
 * Active scheduled alerts (Polling + Monitoring) whose cron has ticked
 * at least once since their last recorded poll. Purely a filter — no
 * side effects, no logs written here. The dispatcher owns everything
 * downstream.
 */
async function collectDueAlerts(): Promise<AlertModel[]> {
  const alerts = await alertRepository.getActiveScheduled();
  return alerts.filter((a: AlertModel) => {
    const p = a.alertParams as ScheduledParams | undefined;
    if (!p?.schedule) return false;
    return scheduler.isDue(p.schedule, p._lastPolledAt);
  });
}
