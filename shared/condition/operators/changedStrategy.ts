// `Changed` — fires when the observed value differs from the previous
// poll's snapshot at the same path. Ignores `threshold`; reads `baseline`.

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";
import { deepEqual } from "./helpers";

export const changedStrategy: OperatorStrategy = {
  operator: ConditionOperator.Changed,

  evaluate(_threshold, observed, baseline) {
    // No baseline → "would fire when next change happens". That's the
    // right answer for previews; the server passes a real baseline at
    // poll time, so this branch only triggers in the UI.
    if (baseline === undefined) {
      return {
        fired: true,
        detail: "would fire on next change (no baseline yet)",
      };
    }
    const changed = !deepEqual(observed, baseline);
    return {
      fired: changed,
      detail: changed ? "changed since last poll" : "unchanged since last poll",
    };
  },
};
