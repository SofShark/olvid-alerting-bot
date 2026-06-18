// Server-side polling condition evaluator. Thin adapter over the centralized
// `evaluateCondition` in `#shared/conditionEval` — all the operator logic,
// wildcard expansion, and aggregation lives there. This file only maps the
// shared result into the server-specific `EvalResult` shape.

import { evaluateCondition } from '#shared/conditionEval'
import type { EvalResult } from '../types'

export function evaluate(
  rawCondition: any,
  parsed:       any,
  baseline:     any | undefined,
): EvalResult {
  const result = evaluateCondition(rawCondition, parsed, baseline)

  // Surface the first path's observed value for the test panel's quick
  // summary; the full per-path breakdown rides on `baselineValue`.
  const first = result.verdicts[0]
  return {
    fired:          result.fired,
    reason:         result.reason,
    observedValue:  first?.observed,
    baselineValue:  result.verdicts,   // full breakdown for callers that render it
  }
}
