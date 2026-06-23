export default defineEventHandler(async (event) => {

  const method = event.node.req.method

  if (method != 'POST'){
    throw createError({ statusCode: 400, statusMessage: 'Woops, you\'re not a webhook are you?' })

  }
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing webhook token' })
  }

  console.log("getting alert element from http request")
  const alert = await bdManager.getAlertByToken(token) as any


  if (!alert) {
    throw createError({ statusCode: 404, statusMessage: 'Webhook not found' })
  }

  // Read the body defensively. If the client posted non-JSON, readBody can
  // throw — capture the raw text so admins can see what came in even when we
  // can't parse it.
  let payload: any = null
  let rawBody:  string | null = null
  try {
    payload = await readBody(event)
  } catch (parseErr: any) {
    try { rawBody = (await readRawBody(event, 'utf-8')) ?? null } catch { /* body already consumed */ }
    await bdManager.upsertLastFailedPayload(alert.id, {
      raw:    rawBody,
      error:  parseErr?.message ?? 'Failed to read request body',
      stage:  'parse',
    })
    throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  }
  console.log(`📥 [Webhook] Token ${token} — alert #${alert.id} with ${alert.bundles.length} bundle(s)`)

  try {
    await alertManager.processAlert(alert, payload)
    // Persist the body as this alert's last-received payload. Keyed by alert
    // id, so two webhook alerts with the same source no longer overwrite each
    // other's history.
    await bdManager.upsertLastAlertPayload(alert.id, payload)
  } catch (error: any) {
    console.error('❌ [Webhook] Unexpected error:', error.message)
    // Persist the failure for admin debugging. The body did parse, so we
    // have a structured `parsed` value; `raw` is left null since we'd have
    // to re-serialize (which would lose info for non-JSON bodies anyway).
    try {
      await bdManager.upsertLastFailedPayload(alert.id, {
        parsed: payload ?? null,
        error:  error?.message ?? 'Unknown error during processAlert',
        stage:  'process',
      })
    } catch (persistErr: any) {
      console.error('❌ [Webhook] failure-persist failed too:', persistErr?.message)
    }
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }

  return { status: 'success', message: 'Webhook accepted and processed' }
})