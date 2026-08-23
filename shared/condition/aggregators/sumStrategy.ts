// `Sum` — numeric reducer: sum of every numeric observed value.

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
