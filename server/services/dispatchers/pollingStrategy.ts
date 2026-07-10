// Dispatch strategy for Source.Polling (shown as "Data Polling" in the UI).
//
// Pipeline: fetch + parse the body → evaluate the PollingCondition against
// the parsed payload → apply the trigger-mode policy → notify bundles.
//
// `pollingEngine` and `notifierService` resolve via Nitro auto-imports.

import type { DispatchStrategy, DispatchResult } from "#shared/types/dispatchStrategy";
import type { AlertModel } from "#shared/types/alert";
import { getPollingParams } from "#shared/types/alert";
import { ConditionOperator } from "#shared/types/condition";
import { conditionEvaluator } from "#shared/condition/conditionEvaluator";
import { FireDecision, firePolicy } from "#shared/condition/firePolicy";

export const pollingStrategy: DispatchStrategy = {
  async execute(alert: AlertModel): Promise<DispatchResult> {
    const params = getPollingParams(alert);
    if (!params) {
      return {
        outcome: { status: "error", error: "Alert has no polling params" },
        paramsPatch: {},
      };
    }

    // 1) Fetch + parse the source body.
    const run = await pollingEngine.retrieve(params.url, params.format);
    if (!run.ok) {
      const msg = run.error ?? "Retrieve failed";
      console.error(
        `[pollingStrategy] alert #${alert.id} retrieve failed: ${msg}`,
      );
      return { outcome: { status: "error", error: msg }, paramsPatch: {} };
    }

    // 2) Evaluate the condition against the freshly-parsed payload.
    const evaluation = conditionEvaluator.evaluate(
      params.condition,
      run.parsed,
      params._baseline,
    );

    // 3) Apply the trigger-mode policy (EveryTime / OneShot / WithRecovery).
    const decision: FireDecision = firePolicy.decide(
      params.condition,
      params.triggerMode,
      evaluation.fired,
      params._lastFired,
    );

    // 4) Notify — the notifier knows about 'alert' vs 'recovery' kinds.
    if (decision.fire) {
      await notifierService.processAlert(alert, run.parsed, decision.kind);
    }

    // 5) Runtime-state patch. `_baseline` is only meaningful for
    //    operator=Changed; for other operators it just bloats the JSON.
    const paramsPatch: Record<string, unknown> = {
      _lastFired: evaluation.fired,
    };
    if (params.condition.operator === ConditionOperator.Changed) {
      paramsPatch._baseline = run.parsed;
    }

    return { outcome: { status: "success", error: null }, paramsPatch };
  },
};
