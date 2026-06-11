import { sampleData, Source } from '#shared/constants'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const source = query.source as string
  const type   = query.type as string   // 'example' | 'last'

  if (!source) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ?source= query param' })
  }

  if (type === 'last') {
    const payload = await bdManager.getLastPayloadForSource(source)
    return { payload }
  }

  // Default: return the built-in example payload for this source.
  const entry = sampleData[source as Source]
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: `No example payload for source "${source}"` })
  }
  return { payload: entry.payload }
})
