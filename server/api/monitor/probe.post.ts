// Monitor probe endpoint — hit a URL once and return the same shape the
// runtime dispatcher hands to the notifier. Used by the format editor so
// what the user sees at design time (`useFormatEditorMonitoring`) matches
// what their Handlebars template receives at fire time.
//
// No condition evaluation, no persistence — pure side-effect-free probe.
// 4xx / 5xx are LEGITIMATE outcomes here, same as in the dispatcher.

import {
  MONITOR_BODY_PREVIEW_MAX,
  type MonitorProbePayload,
} from "~~/server/services/dispatchers/monitoringStrategy";
import { getErrorMessage } from "~/utils/errors";

type ProbeResponse =
  | { ok: true; probe: MonitorProbePayload }
  | { ok: false; error: string };

export default defineEventHandler(async (event): Promise<ProbeResponse> => {
  const body = await readBody<{ url?: string }>(event);
  const url = (body?.url ?? "").trim();
  if (!url) {
    return { ok: false, error: "URL is required" };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: "GET" });
    let bodyPreview = "";
    try {
      const text = await res.text();
      bodyPreview = text.slice(0, MONITOR_BODY_PREVIEW_MAX);
    } catch {
      bodyPreview = "";
    }
    
    return {
      ok: true,
      /*probe: {
        status: res.status,
        url,
        body: bodyPreview,
        latencyMs: Date.now() - t0,
        redirected: res.redirected,
        type: res.type,
      },*/

      probe:{

        status: res.status,
        statusText: res.statusText,
        ok: res.ok,

        url: res.url,
        body: bodyPreview,

        latencyMs: Date.now() - t0,

        redirected: res.redirected,
        type: res.type,

        contentType: res.headers.get("content-type"),
        contentLength: res.headers.get("content-length")
          ? Number(res.headers.get("content-length"))
          : null,
      }
    };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error, "Fetch failed") };
  }
});
