// `Average` — numeric reducer: arithmetic mean of every numeric observed
// value, rounded to 4 decimals so verdict details don't drown in
// floating-point tail.

import { ConditionAggregation } from "../../types/condition";
import type { NumericAggregatorStrategy } from "../../types/aggregatorStrategy";

export const averageStrategy: NumericAggregatorStrategy = {
  aggregation: ConditionAggregation.Average,
  kind: "numeric",
  label: "average",

  collapse(values) {
    const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
    return Math.round(mean * 10000) / 10000;
  },
};
