// Polling dispatcher — takes ONE alert that's known to be due and runs
// the full poll pipeline against it:
//
//   1. retrieve   pollingEngine fetches + parses the source
//   2. evaluate   conditionEvaluator turns payload + condition → verdict
//   3. decide     firePolicy applies the trigger-mode (EveryTime/OneShot/…)
//   4. notify     notifierService dispatches to bundles (if fire)
//   5. persist    alertRepository writes the runtime state back
//   6. log        alertLogRepository appends the outcome to the timeline
//
// The heartbeat task is now just "who + when" (collect the due alerts,
// hand them off). This module is "how" — the entire pipeline lives in
// one place so tracing a poll's lifecycle is a single-file exercise.
//
// Errors are caught internally. Callers only need to `await dispatch(alert)`
// and don't have to worry about crashing the caller loop — the dispatcher
// records the failure to the log and swallows it. `Promise.allSettled` on
// the caller side is still good hygiene for concurrent dispatches.

import type { AlertModel } from "#shared/types/alert";
import type { PollingParams } from "#shared/types/polling";
import { ConditionOperator } from "#shared/types/condition";
import { conditionEvaluator } from "#shared/condition/conditionEvaluator";
import { firePolicy } from "#shared/condition/firePolicy";
import { getErrorMessage } from "~/utils/errors";

// Outcome tracked across the pipeline so the final log-write in the
// `finally` block can record what actually happened (or didn't).
type Outcome = {
  status: "success" | "warning" | "error";
  error: string | null;
};

async function dispatch(alert: AlertModel): Promise<void> {
  const params = alert.alertParams as PollingParams;
  const patch: Partial<PollingParams> = { _lastPolledAt: Date.now() };
  const outcome: Outcome = { status: "success", error: null };

  try {
    // 1) Fetch + parse the source.
    const run = await pollingEngine.retrieve(params.url, params.format);
    if (!run.ok) {
      const msg = run.error ?? "Retrieve failed";
      console.error(
        `[pollingDispatcher] alert #${alert.id} retrieve failed: ${msg}`,
      );
      outcome.status = "error";
      outcome.error = msg;
      return; // _lastPolledAt still gets written in `finally`.
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

    // 5) Build the runtime state patch. `_baseline` is only meaningful
    //    for operator=Changed; for other operators it just bloats the JSON.
    patch._lastFired = evalResult.fired;
    if (params.condition.operator === ConditionOperator.Changed) {
      patch._baseline = run.parsed;
    }
  } catch (e) {
    const msg = getErrorMessage(e, "Unexpected error during poll");
    console.error(`[pollingDispatcher] alert #${alert.id} threw:`, e);
    outcome.status = "error";
    outcome.error = msg;
  } finally {
    // 6) Persist runtime state + append to the log. Both are best-effort —
    //    a repository failure here should never crash the heartbeat loop.
    if (alert.id != null) {
      await persistRuntimeState(alert.id, params, patch);
      await writeOutcomeLog(alert.id, outcome);
    }
  }
}

async function persistRuntimeState(
  alertId: number,
  params: PollingParams,
  patch: Partial<PollingParams>,
) {
  try {
    await alertRepository.updateAlertParams(alertId, { ...params, ...patch });
  } catch (e) {
    console.warn(
      `[pollingDispatcher] alert #${alertId} failed to persist runtime state:`,
      e,
    );
  }
}

async function writeOutcomeLog(alertId: number, outcome: Outcome) {
  try {
    if (outcome.status === "success") {
      await alertLogRepository.logSuccess(alertId);
    } else if (outcome.status === "warning") {
      await alertLogRepository.logWarning(alertId, outcome.error ?? "");
    } else {
      await alertLogRepository.logError(alertId, outcome.error ?? "");
    }
  } catch (e) {
    console.warn(
      `[pollingDispatcher] alert #${alertId} failed to write log:`,
      e,
    );
  }
}

export const pollingDispatcher = { dispatch };
