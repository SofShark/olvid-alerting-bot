import { LogStatus } from "#imports";
import { AlertStatus } from "#shared/types/alert";
import { getErrorMessage } from "~/utils/errors";

/**
 * Webhook receiver. One log row per incoming request:
 *   - success  : notifier accepted the payload and dispatched the alert
 *   - warning  : the request arrived but the alert isn't Active
 *   - error    : body parse failed OR the notifier threw
 */

async function safeLog(
  alertId: number,
  kind: LogStatus,
  msg: string | null = null,
) {
  try {
    if (kind === LogStatus.Success) await alertLogRepository.logSuccess(alertId);
    else if (kind === LogStatus.Warning)
      await alertLogRepository.logWarning(alertId, msg ?? "");
    else await alertLogRepository.logError(alertId, msg ?? "");
  } catch (e) {
    console.warn(
      `[webhook] alert #${alertId} failed to write log:`,
      getErrorMessage(e),
    );
  }
}

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  if (method != "POST") {
    throw createError({
      statusCode: 400,
      statusMessage: "Woops, you're not a webhook are you?",
    });
  }

  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing webhook token",
    });
  }

  console.log("getting alert element from http request");
  const alert = (await alertRepository.getByToken(token)) as any;

  if (!alert) {
    throw createError({ statusCode: 404, statusMessage: "Webhook not found" });
  }

  // Read the body defensively. If the client posted non-JSON, readBody can
  // throw — capture the raw text so admins can see what came in even when we
  // can't parse it.
  let payload: any = null;
  let rawBody: string | null = null;
  try {
    payload = await readBody(event);
  } catch (parseErr: any) {
    try {
      rawBody = (await readRawBody(event, "utf-8")) ?? null;
    } catch {
      /* body already consumed */
    }
    const msg = parseErr?.message ?? "Failed to read request body";
    await alertPayloadRepository.upsertLastFailedPayload(alert.id, {
      raw: rawBody,
      error: msg,
      stage: "parse",
    });
    await safeLog(alert.id, LogStatus.Error, `Invalid body: ${msg}`);
    throw createError({ statusCode: 400, statusMessage: "Invalid body" });
  }

  console.log(
    `📥 [Webhook] Token ${token} — alert #${alert.id} with ${alert.bundles.length} bundle(s)`,
  );

  // Inactive alerts still accept the webhook (so the sender doesn't retry
  // in vain) but we log a warning so the operator sees the mismatch in
  // the timeline.
  if (alert.status !== AlertStatus.Active) {
    await safeLog(
      alert.id,
      LogStatus.Warning,
      `Alert is ${alert.status} — webhook received but not dispatched`,
    );
    return { status: "ignored", message: `Alert is ${alert.status}` };
  }

  try {
    await notifierService.processAlert(alert, payload);
    // Persist the body as this alert's last-received payload. Keyed by alert
    // id, so two webhook alerts with the same source no longer overwrite each
    // other's history.
    await alertPayloadRepository.upsertLastAlertPayload(alert.id, payload);
    await safeLog(alert.id, LogStatus.Success);
  } catch (error: any) {
    const msg = error?.message ?? "Unknown error during processAlert";
    console.error("❌ [Webhook] Unexpected error:", msg);
    // Persist the failure for admin debugging. The body did parse, so we
    // have a structured `parsed` value; `raw` is left null since we'd have
    // to re-serialize (which would lose info for non-JSON bodies anyway).
    try {
      await alertPayloadRepository.upsertLastFailedPayload(alert.id, {
        parsed: payload ?? null,
        error: msg,
        stage: "process",
      });
    } catch (persistErr: any) {
      console.error(
        "❌ [Webhook] failure-persist failed too:",
        persistErr?.message,
      );
    }
    await safeLog(alert.id, LogStatus.Error, msg);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    });
  }

  return { status: "success", message: "Webhook accepted and processed" };
});
