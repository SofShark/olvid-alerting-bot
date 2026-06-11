export default defineEventHandler(async (event) => {
  const method = event.node.req.method

  // 1. GET — all alerts with bundles
  if (method === 'GET') {
    try {
      return await bdManager.getAllAlerts()
    } catch (error: any) {
      console.error('❌ [GET /api/backend]', error)
      throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to fetch alerts' })
    }
  }

  // 2. POST — create alert
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      console.log('📥 [POST /api/backend] Creating alert:', body.title)
      const data = await bdManager.createAlert(body)
      return { success: true, data }
    } catch (error: any) {
      console.error('❌ [POST /api/backend]', error)
      throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to create alert' })
    }
  }

  // 3. PUT — full update (fields + bundles)
  if (method === 'PUT') {
    try {
      const body = await readBody(event)
      console.log('📥 [PUT /api/backend] Updating alert #' + body.id)
      const data = await bdManager.updateAlert(Number(body.id), body)
      return { success: true, data }
    } catch (error: any) {
      console.error('❌ [PUT /api/backend]', error)
      throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to update alert' })
    }
  }

  // 3b. PATCH — status toggle only (active <-> inactive)
  if (method === 'PATCH') {
    try {
      const body = await readBody(event)
      console.log('📥 [PATCH /api/backend] Toggling status for #' + body.id, '->', body.status)
      const data = await bdManager.updateStatus(Number(body.id), body.status)
      return { success: true, data }
    } catch (error: any) {
      console.error('❌ [PATCH /api/backend]', error)
      throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to update status' })
    }
  }

  // 4. DELETE
  if (method === 'DELETE') {
    try {
      const body = await readBody(event)
      console.log('📥 [DELETE /api/backend] Deleting alert #' + body.id)
      await bdManager.deleteAlert(Number(body.id))
      return { success: true }
    } catch (error: any) {
      console.error('❌ [DELETE /api/backend]', error)
      throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to delete alert' })
    }
  }
})
