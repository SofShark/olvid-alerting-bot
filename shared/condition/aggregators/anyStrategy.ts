// `Any` — boolean combinator: at least one watched path's verdict fires.

import { ConditionAggregation } from "../../types/condition";
import type { BooleanAggregatorStrategy } from "../../types/aggregatorStrategy";

export const anyStrategy: BooleanAggregatorStrategy = {
  aggregation: ConditionAggregation.Any,
  kind: "boolean",

  combine(flags) {
    return flags.some(Boolean);
  },
};
