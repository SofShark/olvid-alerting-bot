// `Changed` — fires when the observed value differs from the previous
// poll's snapshot at the same path. Ignores `threshold`; reads `baseline`.

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";
import { deepEqual } from "./helpers";

export const changedStrategy: OperatorStrategy = {
  operator: ConditionOperator.Changed,

  evaluate(_threshold, observed, baseline) {
    if (baseline === undefined) {
      return {
        fired: false,
        detail: "No baseline yet",
      };
    }
    const changed = !deepEqual(observed, baseline);
    return {
      fired: changed,
      detail: changed ? "changed since last poll" : "unchanged since last poll", // TODO i18n
    };
  },
};
