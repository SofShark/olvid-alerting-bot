// Server-side polling condition evaluator. Thin adapter over the centralized
// `conditionEvaluator` in `#shared/condition/conditionEvaluator` — all the
// operator logic, wildcard expansion, and aggregation lives there. This file
// only maps the shared result into the server-specific `EvalResult` shape.

import { conditionEvaluator } from "#shared/condition/conditionEvaluator";
import type { EvalResult } from "../types";

export function evaluate(
  rawCondition: any,
  parsed: any,
  baseline: any | undefined,
): EvalResult {
  const result = conditionEvaluator.evaluate(rawCondition, parsed, baseline);

  // Surface the first path's observed value for the test panel's quick
  // summary; the full per-path breakdown rides on `baselineValue`.
  const first = result.verdicts[0];
  return {
    fired: result.fired,
    reason: result.reason,
    observedValue: first?.observed,
    baselineValue: result.verdicts, // full breakdown for callers that render it
  };
}
