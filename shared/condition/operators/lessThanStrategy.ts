// `LessThan` — strict numeric comparison. Symmetric to GreaterThan.

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";
import { asNumbers } from "./helpers";

export const lessThanStrategy: OperatorStrategy = {
  operator: ConditionOperator.LessThan,

  evaluate(threshold, observed) {
    const nums = asNumbers(observed, threshold);
    if (!nums) {
      return {
        fired: false,
        detail: `non-numeric: "${observed}" or "${threshold}"`,
      };
    }
    const fired = nums[0] < nums[1];
    return {
      fired,
      detail: fired ? `${nums[0]} < ${nums[1]}` : `${nums[0]} ≥ ${nums[1]}`,
    };
  },
};
