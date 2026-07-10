// `GreaterThan` — strict numeric comparison. Non-numeric operands never
// fire; the detail string explains why so the failure is visible in the
// preview breakdown instead of silently passing.

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";
import { asNumbers } from "./helpers";

export const greaterThanStrategy: OperatorStrategy = {
  operator: ConditionOperator.GreaterThan,

  evaluate(threshold, observed) {
    const nums = asNumbers(observed, threshold);
    if (!nums) {
      return {
        fired: false,
        detail: `non-numeric: "${observed}" or "${threshold}"`,
      };
    }
    const fired = nums[0] > nums[1];
    return {
      fired,
      detail: fired ? `${nums[0]} > ${nums[1]}` : `${nums[0]} ≤ ${nums[1]}`,
    };
  },
};
