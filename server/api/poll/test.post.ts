// Test-run an alert's polling configuration end-to-end (fetch + parse +
// evaluate condition) without firing bundles or updating any baseline.
// Used by the "Run test poll" button in the alert view.

import { pollingEngine } from '../../utils/polling/engine'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ alertId?: number | string }>(event)
  const id   = Number(body?.alertId)
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'alertId is required' })
  }
  const alert = await bdManager.getAlertById(id)
  if (!alert) {
    throw createError({ statusCode: 404, statusMessage: `Alert #${id} not found` })
  }
  return await pollingEngine.test(alert)
})
