// Test-run an alert's polling configuration end-to-end (fetch + parse +
// evaluate condition + format each bundle's outgoing message) WITHOUT firing
// bundles or updating any baseline. Used by the "Run test poll" button in
// the alert view.

import { pollingEngine } from "../../utils/polling/engine";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ alertId?: number | string }>(event);
  const id = Number(body?.alertId);
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "alertId is required",
    });
  }

  const alert = await alertRepository.getById(id);
  if (!alert) {
    throw createError({
      statusCode: 404,
      statusMessage: `Alert #${id} not found`,
    });
  }

  const result = await pollingEngine.test(alert);

  // Render each bundle's outgoing message so the test panel can show
  // exactly what would land in each discussion list. Runs whether or not
  // the condition fired — the user wants to preview the formatting too.
  // Errors per bundle are isolated so one broken Handlebars script doesn't
  // wipe out the rest of the breakdown.
  const bundles = (alert.bundles ?? []) as any[];
  const bundleMessages = bundles.map((bundle, index) => {
    try {
      const message = notifierService.formatMessage(
        alert,
        bundle,
        result.parsed,
      );
      return {
        index,
        bundleId: bundle.id ?? null,
        formating: bundle.formating,
        discussionCount: Array.isArray(bundle.discussion_list)
          ? bundle.discussion_list.length
          : 0,
        message,
        error: null,
      };
    } catch (e: any) {
      return {
        index,
        bundleId: bundle.id ?? null,
        formating: bundle.formating,
        discussionCount: Array.isArray(bundle.discussion_list)
          ? bundle.discussion_list.length
          : 0,
        message: "",
        error: e?.message ?? "Failed to format message",
      };
    }
  });

  return { ...result, bundleMessages };
});
