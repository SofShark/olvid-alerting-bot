import {
  ConditionKind,
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  migrateCondition,
} from '#shared/constants'
import type { EvalResult } from '../types'
import { resolvePath } from './pathResolver'

// Generic, format-agnostic condition evaluator. Works on whatever JS object
// the parser produced — XML→object, JSON→object, etc. — so adding a new
// format only requires writing its Parser.

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Try to read both sides as numbers. Returns null when either isn't numeric.
function asNumbers(a: any, b: any): [number, number] | null {
  const na = Number(a), nb = Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) return null
  if (a === null || a === undefined || a === '') return null
  if (b === null || b === undefined || b === '') return null
  return [na, nb]
}

type PerPathVerdict = {
  path:     string
  fired:    boolean
  observed: any
  baseline?: any
  detail:   string
}

function evalPath(
  operator: ConditionOperator,
  value:    string | undefined,
  observed: any,
  baseline: any | undefined,
): { fired: boolean; detail: string } {
  switch (operator) {
    case ConditionOperator.Changed: {
      if (baseline === undefined) {
        return { fired: false, detail: 'no baseline yet — next poll will establish one' }
      }
      const changed = !deepEqual(observed, baseline)
      return { fired: changed, detail: changed ? 'changed since last poll' : 'unchanged since last poll' }
    }
    case ConditionOperator.Equals: {
      // String comparison is the natural default for XML text nodes.
      const fired = String(observed ?? '') === String(value ?? '')
      return { fired, detail: fired ? `equals "${value}"` : `is "${observed}" (expected "${value}")` }
    }
    case ConditionOperator.GreaterThan: {
      const nums = asNumbers(observed, value)
      if (!nums) return { fired: false, detail: `non-numeric: "${observed}" or "${value}"` }
      const fired = nums[0] > nums[1]
      return { fired, detail: fired ? `${nums[0]} > ${nums[1]}` : `${nums[0]} ≤ ${nums[1]}` }
    }
    case ConditionOperator.LessThan: {
      const nums = asNumbers(observed, value)
      if (!nums) return { fired: false, detail: `non-numeric: "${observed}" or "${value}"` }
      const fired = nums[0] < nums[1]
      return { fired, detail: fired ? `${nums[0]} < ${nums[1]}` : `${nums[0]} ≥ ${nums[1]}` }
    }
    case ConditionOperator.Contains: {
      const hay = String(observed ?? '')
      const ndl = String(value    ?? '')
      const fired = ndl.length > 0 && hay.includes(ndl)
      return { fired, detail: fired ? `contains "${ndl}"` : `does not contain "${ndl}"` }
    }
    default:
      return { fired: false, detail: `unknown operator: ${operator}` }
  }
}

export function evaluate(
  rawCondition: any,
  parsed:       any,
  baseline:     any | undefined,
): EvalResult {
  const condition = migrateCondition(rawCondition)

  if (condition.kind === ConditionKind.None) {
    return { fired: true, reason: 'No condition — fires every poll cycle.' }
  }

  if (condition.kind !== ConditionKind.Rule) {
    return { fired: false, reason: `Unknown condition kind: ${(condition as any).kind}` }
  }

  if (condition.paths.length === 0) {
    return { fired: false, reason: 'No fields selected — pick at least one in the source tree.' }
  }

  if (OPERATORS_NEEDING_VALUE.has(condition.operator) && !condition.value) {
    return { fired: false, reason: `Operator "${condition.operator}" needs a value.` }
  }

  const verdicts: PerPathVerdict[] = condition.paths.map((path) => {
    const observed = resolvePath(parsed,   path)
    const prev     = baseline === undefined ? undefined : resolvePath(baseline, path)
    const { fired, detail } = evalPath(condition.operator, condition.value, observed, prev)
    return { path, fired, observed, baseline: prev, detail }
  })

  // Aggregate.
  const aggregation = condition.aggregation ?? ConditionAggregation.All
  const fired =
    aggregation === ConditionAggregation.All
      ? verdicts.every(v => v.fired)
      : verdicts.some (v => v.fired)

  const firedCount = verdicts.filter(v => v.fired).length
  const reason = `${aggregation === ConditionAggregation.All ? 'All' : 'Any'} of ${condition.paths.length} field${condition.paths.length === 1 ? '' : 's'} — ${firedCount}/${condition.paths.length} verified.`

  // Surface the first path's observed value for the test panel summary; the
  // full per-path breakdown is exposed via baselineValue for callers that
  // want to render it.
  const first = verdicts[0]
  return {
    fired,
    reason,
    observedValue: first?.observed,
    baselineValue: verdicts,           // full breakdown
  }
}
