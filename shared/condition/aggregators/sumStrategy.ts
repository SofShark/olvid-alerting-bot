// `Sum` — numeric reducer: Σ of every numeric observed value. The
// operator then evaluates the total ("fire when the sum of all queue
// depths exceeds 100").

import { ConditionAggregation } from "../../types/condition";
import type { NumericAggregatorStrategy } from "../../types/aggregatorStrategy";

export const sumStrategy: NumericAggregatorStrategy = {
  aggregation: ConditionAggregation.Sum,
  kind: "numeric",
  label: "sum",

  collapse(values) {
    return values.reduce((acc, v) => acc + v, 0);
  },
};
