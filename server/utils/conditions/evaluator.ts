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
  return {
    fired: result.fired,
    reason: result.reason,
    verdicts: result.verdicts,
  };
}
