// Polling heartbeat. Fires every minute via Nitro's scheduled-tasks
// system. The registered task name is derived from this file's path
// under `server/tasks/` (using `:` as the directory separator), so this
// file at `server/tasks/polling/heartbeat.ts` becomes `polling:heartbeat`.
// `nuxt.config.ts` references that exact name in `nitro.scheduledTasks`.
//
// Once a tick fires it checks every active polling alert against its
// cron schedule, polls the ones that are due, and routes the outcome
// through the standard fire-decision pipeline:
//   evaluate → firePolicy.decide → notifier.
//
// All persistence happens through `alertRepository.updateAlertParams`,
// which writes the runtime state back to the JSON column. We persist
// `_lastPolledAt` even on failure so a broken URL doesn't get hammered
// every minute.

import { defineTask } from "nitropack/runtime";
import type { AlertModel } from "#shared/types/alert";
import type { PollingParams } from "#shared/types/polling";
import { ConditionOperator } from "#shared/types/condition";
import { scheduler } from "#shared/polling/scheduler";
import { conditionEvaluator } from "#shared/condition/conditionEvaluator";
import { firePolicy } from "#shared/condition/firePolicy";

export default defineTask({
  meta: {
    name: "polling:heartbeat",
    description: "Heartbeat — runs all due polling alerts",
  },
  async run() {
    const due = await collectDueAlerts();
    console.log(`[polling:heartbeat] ${due.length} alert(s) due`);
    const results = await Promise.allSettled(due.map(pollOne));
    return { result: { polled: results.length } };
  },
});

// ── Pipeline ────────────────────────────────────────────────────────────────

async function collectDueAlerts(): Promise<AlertModel[]> {
  const alerts = await alertRepository.getActivePolling();
  return alerts.filter((a) => {
    const p = a.alertParams as PollingParams | undefined;
    if (!p?.schedule) return false;
    return scheduler.isDue(p.schedule, p._lastPolledAt);
  });
}

async function pollOne(alert: AlertModel) {
  const params = alert.alertParams as PollingParams;
  const patch: Partial<PollingParams> = { _lastPolledAt: Date.now() };

  try {
    // 1) Fetch + parse the source.
    const run = await pollingEngine.retrieve(params.url, params.format);
    if (!run.ok) {
      console.error(
        `[polling:heartbeat] alert #${alert.id} retrieve failed: ${run.error}`,
      );
      return; // _lastPolledAt updated in finally — prevents per-minute retry storms.
    }

    // 2) Evaluate the condition against the freshly-parsed payload.
    const evalResult = conditionEvaluator.evaluate(
      params.condition,
      run.parsed,
      params._baseline,
    );

    // 3) Apply the trigger-mode policy (EveryTime / OneShot / WithRecovery).
    const decision = firePolicy.decide(
      params.condition,
      params.triggerMode,
      evalResult.fired,
      params._lastFired,
    );

    // 4) Dispatch — the notifier knows about 'alert' vs 'recovery' kinds.
    if (decision.fire) {
      await notifierService.processAlert(alert, run.parsed, decision.kind);
    }

    // 5) Build the runtime state patch. `_baseline` is only meaningful for
    //    operator=Changed; for other operators it just bloats the JSON.
    patch._lastFired = evalResult.fired;
    if (params.condition.operator === ConditionOperator.Changed) {
      patch._baseline = run.parsed;
    }
  } catch (e) {
    console.error(`[polling:heartbeat] alert #${alert.id} threw:`, e);
  } finally {
    // 6) Persist. Always write — even on failure — so the next tick won't
    //    immediately re-poll.
    if (alert.id != null) {
      await alertRepository.updateAlertParams(alert.id, {
        ...params,
        ...patch,
      });
    }
  }
}
