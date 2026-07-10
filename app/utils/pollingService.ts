// Browser-side wrapper around the polling API endpoints. Keeps $fetch out
// of components so they stay focused on UI state.

export const pollingService = {
  async testOnScreen(alertId: number) {
    return await $fetch("/api/poll/test", {
      method: "POST",
      body: { alertId },
    });
  },
};
