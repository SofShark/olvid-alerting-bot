import { sampleData, Source } from '#shared/constants'

// Three read modes:
//   ?type=example&source=...      → hard-coded sample payload by source name.
//   ?type=last&alertId=...        → most recent SUCCESSFUL payload for this
//                                   alert (webhook body or parsed poll).
//   ?type=lastFailure&alertId=... → most recent FAILURE for this alert, for
//                                   admin debugging. Separate from `last`,
//                                   so a recovery doesn't erase the trail.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type  = query.type as string

  if (type === 'last' || type === 'lastFailure') {
    const alertId = Number(query.alertId)
    if (!Number.isFinite(alertId)) {
      throw createError({ statusCode: 400, statusMessage: 'Missing or invalid ?alertId=' })
    }
    if (type === 'last') {
      const row = await bdManager.getLastAlertPayload(alertId)
      return { payload: row?.payload ?? null, receivedAt: row?.receivedAt ?? null }
    }
    // lastFailure
    const row = await bdManager.getLastFailedPayload(alertId)
    return {
      raw:      row?.raw      ?? null,
      parsed:   row?.parsed   ?? null,
      error:    row?.error    ?? null,
      stage:    row?.stage    ?? null,
      failedAt: row?.failedAt ?? null,
    }
  }

  // Default: hard-coded example payload for the named source.
  const source = query.source as string
  if (!source) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ?source= query param' })
  }
  const entry = sampleData[source as Source]
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: `No example payload for source "${source}"` })
  }
  return { payload: entry.payload }
})
