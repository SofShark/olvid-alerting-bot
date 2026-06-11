import { createHash } from 'crypto'
import type { GenericAPIParams } from '#shared/constants'

/**
 * One polling tick for a Generic API alert.
 *
 * GETs the configured URL, hashes the response body, and fires
 * alertManager.processAlert() only when the hash differs from the last run.
 */
export async function tickGenericAPI(alert: any): Promise<void> {
  const params = (alert.triggerParams ?? {}) as GenericAPIParams

  if (!params.url) {
    console.warn(`⚠️ [GenericAPI] Alert #${alert.id} has no URL configured — skipping`)
    return
  }

  let body: string
  let parsed: any
  try {
    const res = await fetch(params.url, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
    })
    body = await res.text()
  } catch (err: any) {
    console.error(`❌ [GenericAPI] Alert #${alert.id} — failed to fetch ${params.url}:`, err.message)
    return
  }

  const hash = createHash('sha256').update(body).digest('hex')

  if (hash === params._lastHash) {
    console.log(`🔄 [GenericAPI] Alert #${alert.id} — no change`)
    return
  }

  console.log(`🔔 [GenericAPI] Alert #${alert.id} — response changed`)

  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = { raw: body }
  }

  await alertManager.processAlert(alert, parsed)
  await bdManager.updateTriggerParams(alert.id, { ...params, _lastHash: hash })
}
