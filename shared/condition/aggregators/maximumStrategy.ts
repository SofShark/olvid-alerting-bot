// `Maximum` — numeric reducer: largest numeric observed value ("fire
// when the hottest sensor exceeds 90").

import { ConditionAggregation } from "../../types/condition";
import type { NumericAggregatorStrategy } from "../../types/aggregatorStrategy";

export const maximumStrategy: NumericAggregatorStrategy = {
  aggregation: ConditionAggregation.Maximum,
  kind: "numeric",
  label: "maximum",

  collapse(values) {
    return Math.max(...values);
  },
};
