// Default polling message builder. Used by:
//   - BundleCard       (preview of what will be sent on fire)
//   - alertManager     (actual message generation on the server)
//
// Pure: no IO, no DOM. Safe in both Nuxt server and browser contexts.

import {
  ConditionKind,
  ConditionOperator,
  migrateCondition,
} from './constants'

// Same dot-path resolver as the server-side evaluator. Duplicated here to
// keep this module dependency-free.
function resolvePath(obj: any, path: string): any {
  if (!path) return undefined
  const parts = path.split('.').filter(Boolean)
  let cur: any = obj
  for (const part of parts) {
    if (cur == null) return undefined
    cur = cur[part]
  }
  return cur
}

function asText(v: any): string {
  if (v === null || v === undefined) return '(no value)'
  if (typeof v === 'string')          return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return String(v) }
}

// "Live" per-path evaluation — used during preview when there's no baseline
// available. The scheduled engine bypasses this by passing pre-computed
// verdicts.
function liveEval(operator: ConditionOperator, threshold: string | undefined, observed: any): boolean {
  switch (operator) {
    case ConditionOperator.Changed:
      // Can't decide change without a baseline. We surface the path anyway
      // so the user can preview the path/value shape, marking everything as
      // "would fire on next change".
      return true
    case ConditionOperator.Equals:
      return String(observed ?? '') === String(threshold ?? '')
    case ConditionOperator.GreaterThan: {
      const a = Number(observed), b = Number(threshold)
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b
    }
    case ConditionOperator.LessThan: {
      const a = Number(observed), b = Number(threshold)
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b
    }
    case ConditionOperator.Contains: {
      const t = String(threshold ?? '')
      return t.length > 0 && String(observed ?? '').includes(t)
    }
  }
  return false
}

function lineFor(
  operator: ConditionOperator,
  path: string,
  threshold: string | undefined,
  observed: any,
): string {
  switch (operator) {
    case ConditionOperator.Changed:
      return `${path} → ${asText(observed)}  (changed)`
    case ConditionOperator.Equals:
      return `${path} = ${asText(observed)}  (= "${asText(threshold)}")`
    case ConditionOperator.GreaterThan:
      return `${path} = ${asText(observed)}  (> ${asText(threshold)})`
    case ConditionOperator.LessThan:
      return `${path} = ${asText(observed)}  (< ${asText(threshold)})`
    case ConditionOperator.Contains:
      return `${path} = "${asText(observed)}"  (contains "${asText(threshold)}")`
    default:
      return `${path}: ${asText(observed)}`
  }
}

export type Verdict = { path: string; observed: any; fired: boolean }

/**
 * Build the polling-default message for an alert + observed payload.
 *
 * @param alert    Has at least { title, description, triggerParams.condition }
 * @param payload  The parsed source object (for XML this is the parsed tree)
 * @param verdicts Optional per-path verdicts from the live engine. When
 *                 provided, only the fired ones are listed. When omitted,
 *                 the formatter live-evaluates the non-`changed` operators.
 */
export function buildPollingDefaultMessage(
  alert:    any,
  payload:  any,
  verdicts?: Verdict[],
): string {
  const title = alert?.title ?? 'Polling alert'
  const cond  = migrateCondition(alert?.triggerParams?.condition)

  if (cond.kind === ConditionKind.None) {
    return `📡 ${title}\nPolled successfully (no condition — fires every cycle).`
  }
  if (cond.paths.length === 0) {
    return `📡 ${title}\nPolled successfully.`
  }

  // Determine which paths fired.
  let fired: Verdict[]
  if (verdicts && verdicts.length > 0) {
    fired = verdicts.filter(v => v.fired)
  } else {
    fired = cond.paths
      .map((path) => {
        const observed = resolvePath(payload, path)
        return { path, observed, fired: liveEval(cond.operator, cond.value, observed) }
      })
      .filter(v => v.fired)
  }

  if (fired.length === 0) {
    // Could happen during preview if no field currently passes — useful to
    // tell the user "your rule would not fire on the current snapshot".
    return `📡 ${title}\nNo watched fields currently verify the condition on this snapshot.`
  }

  const lines = fired.map(v => `• ${lineFor(cond.operator, v.path, cond.value, v.observed)}`)
  return `📡 ${title}\n${lines.join('\n')}`
}
