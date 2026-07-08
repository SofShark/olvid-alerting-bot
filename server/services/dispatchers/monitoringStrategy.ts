// Dispatch strategy for Source.Monitoring.
//
// Pipeline: probe the endpoint capturing status + body preview + latency
// → match the status against the alert's StatusMatch rule → apply the
// trigger-mode policy → notify bundles.
//
// A non-2xx res is a LEGITIMATE outcome for a monitor, not a fetch
// failure — only network errors go through the error path.
//
// The payload handed to the notifier (and to the format-editor preview
// via /api/monitor/probe) is a flat, Handlebars-friendly object:
//
//   { status, url, body, latencyMs }
//
// Body is capped at MONITOR_BODY_PREVIEW_MAX chars — enough to
// distinguish "Not Found" / "internal error: xxx" in a template without
// bloating the notifier payload or the persisted last-alert-payload
// row. See MONITOR_BODY_PREVIEW_MAX below for the exact limit.

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

/** Max chars of res body surfaced in the notifier payload and in
 *  the format-editor preview. Same limit used by /api/monitor/probe so
 *  what the user sees at design time matches what runtime notifiers
 *  receive at fire time. */
export const MONITOR_BODY_PREVIEW_MAX = 100;

/** Shape handed to the notifier and returned by /api/monitor/probe.
 *  Kept flat so Handlebars templates can reference `{{status}}`,
 *  `{{body}}`, `{{url}}`, `{{latencyMs}}` without ceremony. */

export type MonitorProbePayload = {
  status: number;
  statusText: string;
  ok: boolean;

  url: string;
  body?: string;

  latencyMs: number;

  redirected: boolean;
  type: ResponseType;

  contentType?: string | null;
  contentLength?: number | null;
  headers?: Record<string, string>;
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

    // 1) Probe. Capture status + body preview + latency; do NOT throw on
    //    4xx/5xx — those are legitimate outcomes. Only network / abort
    //    errors bail out through the catch.
    const t0 = Date.now();
    let httpStatus = 0;
    let bodyPreview = "";
    let res: Response;
    try {
      res = await fetch(params.url, { method: "GET" });
      httpStatus = res.status;
      // Reading the body is best-effort — a hostile server might close
      // the socket mid-read. The status alone is still meaningful, so
      // we degrade to an empty body preview instead of failing.
      try {
        const text = await res.text();
        bodyPreview = text.slice(0, MONITOR_BODY_PREVIEW_MAX);
      } catch {
        bodyPreview = "";
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, "Fetch failed");
      console.error(
        `[monitoringStrategy] alert #${alert.id} fetch error: ${msg}`,
      );
      return { outcome: { status: "error", error: msg }, paramsPatch: {} };
    }
    const latencyMs = Date.now() - t0;

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
    
    // 4) Notify. Flat payload for Handlebars — see MonitorProbePayload.
    if (decision.fire) {
      const payload: MonitorProbePayload = {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,

      url: res.url,
      body: bodyPreview,

      latencyMs,

      redirected: res.redirected,
      type: res.type,

      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length")
        ? Number(res.headers.get("content-length"))
        : null,
    };

      await notifierService.processAlert(alert, payload, decision.kind);
    }

    return {
      outcome: { status: "success", error: null },
      paramsPatch: { _lastFired: fired, _lastStatus: httpStatus },
    };
  },
};
