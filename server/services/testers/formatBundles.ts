// Shared "render each bundle's outgoing message" step used by every
// tester. Called AFTER the source-specific probe/parse succeeds; runs
// once per bundle, catches Handlebars/formatter errors per bundle so
// one broken template doesn't wipe the rest of the breakdown.
//
// Kept as a plain module (not a class) so both testers auto-import it
// from `server/services/testers` and callers don't touch notifierService
// directly.

import type { AlertModel } from "#shared/types/alert";
import type { BundleMessageResult } from "#shared/types/testResult";

export function formatBundleMessages(
  alert: AlertModel,
  payload: unknown,
): BundleMessageResult[] {
  const bundles = (alert.bundles ?? []) as any[];
  return bundles.map((bundle, index) => {
    // Post-schema-refactor: bundles carry polymorphic `outputs` rows
    // (Olvid discussions today, other channels tomorrow). The "count"
    // in the result modal is really "number of delivery targets" —
    // keep the field name stable for the UI, source it from outputs.
    const discussionCount = Array.isArray(bundle.outputs)
      ? bundle.outputs.length
      : 0;
    try {
      const message = notifierService.formatMessage(alert, bundle, payload);
      return {
        index,
        bundleId: bundle.id ?? null,
        formating: bundle.formating,
        discussionCount,
        message,
        error: null,
      };
    } catch (e: any) {
      return {
        index,
        bundleId: bundle.id ?? null,
        formating: bundle.formating,
        discussionCount,
        message: "",
        error: e?.message ?? "Failed to format message",
      };
    }
  });
}
