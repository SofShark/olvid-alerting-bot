// `Contains` — substring match. An empty threshold never fires (every
// string "contains" the empty needle, which is never what the user meant).

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";

export const containsStrategy: OperatorStrategy = {
  operator: ConditionOperator.Contains,

  evaluate(threshold, observed) {
    const hay = String(observed ?? "");
    const needle = String(threshold ?? "");
    const fired = needle.length > 0 && hay.includes(needle);
    return {
      fired,
      detail: fired ? `contains "${needle}"` : `does not contain "${needle}"`,
    };
  },
};
