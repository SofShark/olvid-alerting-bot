// Default polling message builder. Used by:
//   - BundleCard       (preview of what will be sent on fire)
//   - alertManager     (actual message generation on the server)
//
// Pure: no IO, no DOM. Safe in both Nuxt server and browser contexts.
// All evaluation logic lives in `./conditionEval` — this module only formats.

import { ConditionKind, ConditionOperator } from './constants'
import { evaluateCondition } from './conditionEval'

function asText(v: any): string {
  if (v === null || v === undefined) return '(no value)'
  if (typeof v === 'string')          return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return String(v) }
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

/**
 * Build the polling-default message for an alert + observed payload.
 *
 * @param alert    Has at least { title, description, alertParams.condition }
 * @param payload  The parsed source object (for XML this is the parsed tree)
 * @param baseline Optional previous-poll snapshot — pass on the server for
 *                 accurate `changed` evaluation. Omit in previews; the
 *                 evaluator treats no-baseline as "fires on next change".
 */
export function buildPollingDefaultMessage(
  alert:    any,
  payload:  any,
  baseline?: any,
): string { 
  const title = alert?.title ?? 'Polling alert'
  // Support both shapes during the transition: new `alertParams.condition`,
  // legacy `triggerParams.condition`. Both eventually pass through
  // migrateCondition inside evaluateCondition anyway.
  const cond = alert?.alertParams?.condition ?? alert?.triggerParams?.condition
  const result = evaluateCondition(cond, payload, baseline)

  if (result.kind === ConditionKind.None) {
    return `📡 ${title}\nPolled successfully (no condition — fires every cycle).`
  }
  if (result.verdicts.length === 0) {
    // Empty paths / missing value / etc. — evaluator already encoded the why.
    return `📡 ${title}\n${result.reason}`
  }

  const fired = result.verdicts.filter(v => v.fired)
  if (fired.length === 0) {
    // Could happen during preview if no field currently passes — useful to
    // tell the user "your rule would not fire on the current snapshot".
    return `📡 ${title}\nNo watched fields currently verify the condition on this snapshot.`
  }

  const lines = fired.map(v =>
    `• ${lineFor(result.condition.operator, v.path, result.condition.value, v.observed)}`,
  )
  return `📡 ${title}\n${lines.join('\n')}`
}
