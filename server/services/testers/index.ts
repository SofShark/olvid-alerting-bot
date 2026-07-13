// Dispatch by Source. The endpoint holds one reference — this object
// — and never learns about polling vs monitoring; adding a new source
// means dropping a `<source>Tester.ts` next to these two and wiring it
// in below.

import type { AlertModel } from "#shared/types/alert";
import type { AlertTestResult } from "#shared/types/testResult";
import { Source } from "#shared/types/source";
import { pollingTester } from "./pollingTester";
import { monitoringTester } from "./monitoringTester";

export const alertTester = {
  /** True if this alert has a server-side "run once" path. Webhook
   *  alerts fire in response to inbound requests, so there is nothing
   *  to trigger from our side — the UI hides the action for them. */
  supports(alert: Pick<AlertModel, "input">): boolean {
    return alert.input === Source.Polling || alert.input === Source.Monitoring;
  },

  async test(alert: AlertModel): Promise<AlertTestResult> {
    switch (alert.input) {
      case Source.Polling:
        return pollingTester.test(alert);
      case Source.Monitoring:
        return monitoringTester.test(alert);
      default:
        return {
          ok: false,
          error: `Alerts of type "${alert.input}" cannot be tested`,
          bundleMessages: [],
        };
    }
  },
};
