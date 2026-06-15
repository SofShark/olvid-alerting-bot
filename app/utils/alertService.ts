// Client-side abstraction over the /api/backend endpoints. Top-level of
// utils/ so Nuxt's auto-import picks it up — sub-directory scanning is
// inconsistent across Nuxt versions.

export const alertService = {
  // 1. Get every saved alert (with its bundles).
  async getAll() {
    return await $fetch('/api/backend')
  },

  // 2. Create a new alert.
  async saveAlert(form: object) {
    return await $fetch('/api/backend', {
      method: 'POST',
      body: form,
    })
  },

  // 3. Update an existing alert (fields + bundles).
  async updateAlert(form: object) {
    return await $fetch('/api/backend', {
      method: 'PUT',
      body: form,
    })
  },

  // 4. Toggle / set the status (active | inactive). The server refuses to
  //    activate an alert that has no bundles.
  async setStatus(id: number, status: string) {
    return await $fetch('/api/backend', {
      method: 'PATCH',
      body: { id, status },
    })
  },

  // 5. Delete an alert (cascades its bundles).
  async delete(alertId: number) {
    return await $fetch('/api/backend', {
      method: 'DELETE',
      body: { id: alertId },
    })
  },

  // 6. Available Olvid discussions for the selectors.
  async getDiscussionList() {
    return await $fetch('/api/discussions')
  },
}
