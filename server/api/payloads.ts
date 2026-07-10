// Payload lookup for the FormatEditor.
//
// Two modes:
//   ?type=success&alertId=...  → most recent SUCCESSFUL payload for this
//                                alert (webhook body or parsed poll).
//   ?type=failed&alertId=...   → most recent FAILURE for this alert, for
//                                admin debugging. Separate from `success`,
//                                so a recovery doesn't erase the trail.
//
// Library examples are NOT served from here — the front-end imports them
// directly from `#shared/payloadTemplates` via `getWebhookSample()`. No
// HTTP roundtrip needed because the library is dev-defined static data.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const type = query.type as string;

  if (type !== "success" && type !== "failed") {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported ?type=${type ?? "<missing>"}. Use 'success' or 'failed'.`,
    });
  }

  const alertId = Number(query.alertId);
  if (!Number.isFinite(alertId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid ?alertId=",
    });
  }

  if (type === "success") {
    const row = await alertRepository.getLastAlertPayload(alertId);
    return {
      payload: row?.payload ?? null,
      receivedAt: row?.receivedAt ?? null,
    };
  }

  const row = await alertRepository.getLastFailedPayload(alertId);
  return {
    raw: row?.raw ?? null,
    parsed: row?.parsed ?? null,
    error: row?.error ?? null,
    stage: row?.stage ?? null,
    failedAt: row?.failedAt ?? null,
  };
});
