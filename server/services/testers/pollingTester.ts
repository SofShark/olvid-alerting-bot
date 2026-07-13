// Polling flavour of "test this alert once". Delegates the fetch +
// parse + condition eval to pollingEngine.test — which is the same
// path the runtime scheduler uses, minus baseline persistence and
// bundle firing — then homogenizes the return into AlertTestResult.

import type { AlertModel } from "#shared/types/alert";
import type { AlertTestResult } from "#shared/types/testResult";
import { pollingEngine } from "../../utils/engine";
import { formatBundleMessages } from "./formatBundles";

export const pollingTester = {
  async test(alert: AlertModel): Promise<AlertTestResult> {
    const engineResult = await pollingEngine.test(alert as any);

    // engineResult.ok=false ⇒ fetch or parse failed before condition eval.
    // Return early with the error preserved; bundle messages can't be
    // meaningful without a parsed payload.
    if (!engineResult.ok) {
      return {
        ok: false,
        error: engineResult.error ?? "Test failed",
        parsed: engineResult.parsed,
        condition: engineResult.condition,
        bundleMessages: [],
      };
    }

    return {
      ok: true,
      error: null,
      parsed: engineResult.parsed,
      condition: engineResult.condition,
      bundleMessages: formatBundleMessages(alert, engineResult.parsed),
    };
  },
};
