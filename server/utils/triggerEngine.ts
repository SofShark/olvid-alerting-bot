import { Trigger, AlertStatus } from '#shared/constants'
import { tickRSS } from './pollers/rssPoller'
import { tickGenericAPI } from './pollers/genericPoller'

/**
 * Singleton that manages all polling timers.
 * Started once via server/plugins/triggerEngine.ts at Nitro boot.
 * API handlers call register/unregister when alert status or config changes.
 */

type Handle = { cancel: () => void }
const handles = new Map<number, Handle>()

async function runTick(id: number): Promise<void> {
  try {
    const fresh = await bdManager.getAlertById(id) as any
    if (!fresh || fresh.status !== AlertStatus.Active) {
      triggerEngine.unregister(id)
      return
    }
    switch (fresh.input) {
      case 'RSS Feed':    await tickRSS(fresh);        break
      case 'Generic API': await tickGenericAPI(fresh); break
      default:
        console.warn(`⚠️ [Engine] Unknown polling source "${fresh.input}" for alert #${id}`)
    }
  } catch (err) {
    console.error(`❌ [Engine] Tick error for alert #${id}:`, err)
  }
}

/** Milliseconds until the next occurrence of a "HH:MM" time today (or tomorrow). */
function msUntilTime(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const now  = new Date()
  const next = new Date()
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1) 
  return next.getTime() - now.getTime()
}

function buildHandle(alert: any): Handle {
  const params  = alert.triggerParams ?? {}
  const id      = alert.id as number
  const isDaily = Number(params.intervalSeconds) === 86400 && params.dailyAt

  if (isDaily) {
    // Fire at the configured time each day.
    const delay = msUntilTime(params.dailyAt as string)
    let intervalId: ReturnType<typeof setInterval>

    const timeoutId = setTimeout(() => {
      runTick(id)
      intervalId = setInterval(() => runTick(id), 86_400_000)
    }, delay)

    const hhmm = params.dailyAt as string
    console.log(`⏱️ [Engine] Alert #${id} (${alert.input}) daily at ${hhmm} — next in ${Math.round(delay / 60000)} min`)

    return {
      cancel: () => {
        clearTimeout(timeoutId)
        clearInterval(intervalId)
      },
    }
  } else {
    // Regular interval.
    const seconds = Number(params.intervalSeconds)
    const ms = Math.max(10, isNaN(seconds) ? 60 : seconds) * 1000

    const intervalId = setInterval(() => runTick(id), ms)
    console.log(`⏱️ [Engine] Alert #${id} (${alert.input}) every ${ms / 1000}s`)

    return { cancel: () => clearInterval(intervalId) }
  }
}

export const triggerEngine = {

  async initialize() {
    const allAlerts = await bdManager.getAllAlerts() as any[]
    const pollingAlerts = allAlerts.filter(
      a => a.status === AlertStatus.Active && a.triggerType === Trigger.Polling
    )
    for (const alert of pollingAlerts) this.register(alert)
    console.log(`✅ [Engine] Initialized — ${pollingAlerts.length} polling alert(s) registered`)
  },

  register(alert: any) {
    if (alert.triggerType !== Trigger.Polling) return
    if (alert.status !== AlertStatus.Active)   return
    this.unregister(alert.id)
    handles.set(alert.id, buildHandle(alert))
  },

  unregister(id: number) {
    const h = handles.get(id)
    if (h) {
      h.cancel()
      handles.delete(id)
      console.log(`🛑 [Engine] Alert #${id} unregistered`)
    }
  },
}
