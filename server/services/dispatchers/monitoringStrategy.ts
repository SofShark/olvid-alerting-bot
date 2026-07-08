// Dispatch strategy for Source.Monitoring.
//
// Pipeline: probe the endpoint capturing the HTTP status code (the body
// is never parsed) → match the status against the alert's StatusMatch
// rule → apply the trigger-mode policy → notify bundles.
//
// A non-2xx response is a LEGITIMATE outcome for a monitor, not a fetch
// failure — only network errors go through the error path.

import type { DispatchStrategy, DispatchResult } from "#shared/types/dispatchStrategy";
import type { AlertModel } from "#shared/types/alert";
import { getMonitorParams } from "#shared/types/alert";
import type { PollingCondition } from "#shared/types/condition";
import {
  ConditionAggregation,
  ConditionKind,
  ConditionOperator,
} from "#shared/types/condition";
import { firePolicy } from "#shared/condition/firePolicy";
import { statusMatches } from "#shared/polling/matcher";
import { getErrorMessage } from "~/utils/errors";

// firePolicy special-cases kind=None and operator=Changed (edge-native
// conditions). Monitoring wants the STANDARD path, where trigger modes
// apply — this synthetic rule keeps it there. Only `kind` and `operator`
// are ever read by firePolicy.decide.
const SYNTHETIC_RULE: PollingCondition = {
  kind: ConditionKind.Rule,
  operator: ConditionOperator.Equals, // any non-Changed operator works
  paths: [],
  aggregation: ConditionAggregation.All,
};

export const monitoringStrategy: DispatchStrategy = {
  async execute(alert: AlertModel): Promise<DispatchResult> {
    const params = getMonitorParams(alert);
    if (!params) {
      return {
        outcome: { status: "error", error: "Alert has no monitor params" },
        paramsPatch: {},
      };
    }

    // 1) Probe. Capture the status; do NOT throw on 4xx/5xx.
    let httpStatus = 0;
    try {
      const res = await fetch(params.url, { method: "GET" });
      httpStatus = res.status;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, "Fetch failed");
      console.error(
        `[monitoringStrategy] alert #${alert.id} fetch error: ${msg}`,
      );
      return { outcome: { status: "error", error: msg }, paramsPatch: {} };
    }

    // 2) Match the observed status against the alert's rule.
    const fired = statusMatches(params.match, httpStatus);

    // 3) Same trigger-mode policy as polling — firePolicy only needs the
    //    boolean and the previous poll's boolean for edge detection.
    const decision = firePolicy.decide(
      SYNTHETIC_RULE,
      params.triggerMode,
      fired,
      params._lastFired,
    );

    // 4) Notify. Payload is the observed status + URL, enough for a
    //    Handlebars template to say "endpoint X returned status Y".
    if (decision.fire) {
      await notifierService.processAlert(
        alert,
        { status: httpStatus, url: params.url },
        decision.kind,
      );
    }

    return {
      outcome: { status: "success", error: null },
      paramsPatch: { _lastFired: fired, _lastStatus: httpStatus },
    };
  },
};
