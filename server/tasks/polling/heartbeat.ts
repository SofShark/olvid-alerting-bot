// Polling heartbeat. Fires every minute via Nitro's scheduled-tasks
// system. The registered task name is derived from this file's path
// under `server/tasks/` (using `:` as the directory separator), so this
// file at `server/tasks/polling/heartbeat.ts` becomes `polling:heartbeat`.
// `nuxt.config.ts` references that exact name in `nitro.scheduledTasks`.
//
// Responsibility split:
//   - heartbeat (this file)  → who + when. Reads all active polling
//                              alerts, filters by cron dueness, hands
//                              each due alert off to the dispatcher.
//   - pollingDispatcher      → how. Retrieves the source, evaluates the
//                              condition, decides fire/no-fire, notifies,
//                              persists runtime state, writes the log.
//
// This file stays minimal on purpose — the pipeline is somewhere else,
// so a scheduling problem never gets confused with a poll-execution
// problem.

import { defineTask } from "nitropack/runtime";
import type { AlertModel } from "#shared/types/alert";
import type { PollingParams } from "#shared/types/polling";
import { scheduler } from "#shared/polling/scheduler";

export default defineTask({
  meta: {
    name: "polling:heartbeat", // must match the key in nuxt.config's scheduledTasks
    description: "Heartbeat — dispatches every polling alert that's due",
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
 * Active polling alerts whose cron has ticked at least once since their
 * last recorded poll. Purely a filter — no side effects, no logs written
 * here. The dispatcher owns everything downstream.
 */
async function collectDueAlerts(): Promise<AlertModel[]> {
  const alerts = await alertRepository.getActivePolling();
  return alerts.filter((a: AlertModel) => {
    const p = a.alertParams as PollingParams | undefined;
    if (!p?.schedule) return false;
    return scheduler.isDue(p.schedule, p._lastPolledAt);
  });
}
