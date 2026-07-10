// `Minimum` — numeric reducer: smallest numeric observed value ("fire
// when the lowest replica count drops below 2").

import { ConditionAggregation } from "../../types/condition";
import type { NumericAggregatorStrategy } from "../../types/aggregatorStrategy";

export const minimumStrategy: NumericAggregatorStrategy = {
  aggregation: ConditionAggregation.Minimum,
  kind: "numeric",
  label: "minimum",

  collapse(values) {
    return Math.min(...values);
  },
};
