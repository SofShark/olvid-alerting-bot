// Polling orchestrator. Two entry points so far, both side-effect-free with
// respect to alert state (no bundle firing, no baseline persistence):
//
//   retrieve(url, format) — just fetch + parse. Used by the wizard's
//     "Retrieve" button to populate the click-to-select tree.
//
//   test(alert)           — fetch + parse + evaluate the alert's saved
//     condition against its stored baseline. Used by the "Run test poll"
//     button in the alert view.
//
// When the scheduled-cycles engine is added later, it will reuse retrieve()
// + the evaluator, and add the missing pieces (baseline persistence + bundle
// firing via alertManager.processAlert).

import { getParser } from './parsers'
import { evaluate } from './conditions/evaluator'
import type { RunResult } from './types'

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return await res.text()
}

export const pollingEngine = {

  async retrieve(url: string, format: string): Promise<RunResult> {
    if (!url)    return { ok: false, url: '', format, error: 'URL is required' }
    if (!format) return { ok: false, url, format: '', error: 'Format is required' }

    const parser = getParser(format)
    if (!parser) return { ok: false, url, format, error: `No parser available for format "${format}"` }

    let raw = ''
    try {
      raw = await fetchText(url)
    } catch (e: any) {
      console.error('[pollingEngine] fetch failed:', e)
      return { ok: false, url, format, error: e?.message ?? 'Fetch error' }
    }

    try {
      const { parsed, error } = parser.parse({ raw })
      return { ok: !error, url, format, raw, parsed, error }
    } catch (e: any) {
      console.error('[pollingEngine] parse threw despite internal try/catch:', e)
      return { ok: false, url, format, raw, error: e?.message ?? 'Parse error' }
    }
  },

  async test(alert: any): Promise<RunResult> {
    const params = (alert?.triggerParams ?? {}) as any
    const url    = params.url
    const format = params.format
    const r = await this.retrieve(url, format)

    // Persist BOTH outcomes (success vs failure) keyed by alert id. Failures
    // go into a separate table so a subsequent success doesn't erase the
    // diagnostic trail — admins always see the last failure even if the
    // alert is currently healthy.
    //
    // `r.raw === undefined` ⇒ fetch never produced bytes (network/HTTP),
    // `r.raw !== undefined && !r.parsed` ⇒ bytes arrived but parsing broke.
    if (alert?.id != null) {
      if (!r.ok) {
        try {
          await bdManager.upsertLastFailedPayload(alert.id, {
            raw:    r.raw ?? null,
            parsed: r.parsed ?? null,
            error:  r.error ?? 'Unknown error',
            stage:  r.raw === undefined ? 'fetch' : 'parse',
          })
        } catch (e: any) {
          console.error('[pollingEngine] failed to persist failure:', e?.message ?? e)
        }
        return r
      }
      if (r.parsed !== undefined) {
        try {
          await bdManager.upsertLastAlertPayload(alert.id, r.parsed)
        } catch (e: any) {
          console.error('[pollingEngine] failed to persist last payload:', e?.message ?? e)
        }
      }
    } else if (!r.ok) {
      return r
    }

    const baseline   = params._baseline   // present once the live engine has run
    const condResult = evaluate(params.condition, r.parsed, baseline)
    return { ...r, condition: condResult }
  },
}
