// `All` — boolean combinator: every watched path's verdict must fire.
// The meaningful unit is the POST-EXPANSION path set, so a wildcard chip
// that matched five entries needs all five to verify.

import { ConditionAggregation } from "../../types/condition";
import type { BooleanAggregatorStrategy } from "../../types/aggregatorStrategy";

export const allStrategy: BooleanAggregatorStrategy = {
  aggregation: ConditionAggregation.All,
  kind: "boolean",

  combine(flags) {
    return flags.every(Boolean);
  },
};
