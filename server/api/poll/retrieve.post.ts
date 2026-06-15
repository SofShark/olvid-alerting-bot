// Fetch + parse a URL — used by the wizard's ConditionEditor "Retrieve" button.
// Side-effect-free: does not touch any alert or DB row.

import { pollingEngine } from '../../utils/polling/engine'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ url?: string; format?: string }>(event)
    const url    = (body?.url    ?? '').trim()
    const format = (body?.format ?? '').trim()
    return await pollingEngine.retrieve(url, format)
  } catch (e: any) {
    // Never surface as a raw 500 — the UI can render the message inline.
    console.error('[POST /api/poll/retrieve] unexpected:', e)
    return {
      ok: false,
      url: '',
      format: '',
      error: e?.message ?? 'Unexpected server error in /api/poll/retrieve',
    }
  }
})
