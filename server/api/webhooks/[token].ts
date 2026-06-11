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

  const payload = await readBody(event)
  console.log(`📥 [Webhook] Token ${token} — alert #${alert.id} with ${alert.bundles.length} bundle(s)`)

  try {
    await alertManager.processAlert(alert, payload)
    if (alert.input) {
      await bdManager.upsertLastPayload(alert.input, payload)
    }
  } catch (error: any) {
    console.error('❌ [Webhook] Unexpected error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }

  return { status: 'success', message: 'Webhook accepted and processed' }
})