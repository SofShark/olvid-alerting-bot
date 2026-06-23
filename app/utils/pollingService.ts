// Browser-side wrapper around the polling API endpoints. Keeps $fetch out
// of components so they stay focused on UI state.

export const pollingService = {
  /**
   * Run the polling pipeline once for a given alert WITHOUT firing bundles.
   * Used by the "Run test poll" button in the alert view. Returns whatever
   * `/api/poll/test` responds with (RunResult shape: ok, parsed, condition,
   * raw, error, …) — the component renders the breakdown.
   */
  async testOnScreen(alertId: number) {
    return await $fetch('/api/poll/test', {
      method: 'POST',
      body: { alertId },
    })
  },
}
