// Browser-side wrapper around the unified `run this alert once`
// endpoint. Keeps $fetch and URL knowledge out of components.
//
// Components call `testService.testAlert(id)` and get back an
// AlertTestResult — no knowledge of polling vs monitoring, no URL,
// no HTTP verb.

import type { AlertTestResult } from "#shared/types/testResult";

export const testService = {
  async testAlert(alertId: number): Promise<AlertTestResult> {
    return await $fetch<AlertTestResult>(`/api/alerts/${alertId}/test`, {
      method: "POST",
    });
  },
};
