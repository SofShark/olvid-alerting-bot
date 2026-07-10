// Contract for a condition-operator strategy (Strategy pattern).
//
// Each ConditionOperator value ships one object implementing this
// interface under `shared/condition/operators/`. The evaluator delegates
// per-path comparison to the strategy returned by `operatorFactory` —
// no operator `switch` survives in the evaluator itself.
//
// Lives in shared/types because both the evaluator (shared) and any
// future UI preview logic consume it, on client and server alike.

import type { ConditionOperator } from "./condition";

export type OperatorVerdict = {
  fired: boolean;
  /** Human-readable explanation, surfaced in the per-field breakdown of
   *  the wizard preview and in notification messages. */
  detail: string;
};

export interface OperatorStrategy {
  /** The ConditionOperator value this strategy implements. */
  readonly operator: ConditionOperator;

  /** Compare one observed value against the rule.
   *  @param threshold  User-supplied literal (undefined for operators
   *                    that don't take a value, e.g. Changed).
   *  @param observed   Value at the watched path in the current poll.
   *  @param baseline   Value at the same path on the previous poll
   *                    (undefined in previews). Only Changed reads it. */
  evaluate(
    threshold: string | undefined,
    observed: unknown,
    baseline: unknown,
  ): OperatorVerdict;
}
