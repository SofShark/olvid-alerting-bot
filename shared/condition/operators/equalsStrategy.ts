// `Equals` — string equality. Both sides are coerced to strings so a
// numeric payload value matches its string representation from the UI
// ("42" equals 42).

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";

export const equalsStrategy: OperatorStrategy = {
  operator: ConditionOperator.Equals,

  evaluate(threshold, observed) {
    const fired = String(observed ?? "") === String(threshold ?? "");
    return {
      fired,
      detail: fired
        ? `equals "${threshold}"`
        : `is "${observed}" (expected "${threshold}")`,
    };
  },
};
