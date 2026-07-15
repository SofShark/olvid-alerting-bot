// Factory: ConditionOperator → operator strategy.
//
// The lookup map below replaces the switch that used to live inside
// `conditionEvaluator.evalOne`. Adding a new operator =
//   1. add its value to the ConditionOperator enum,
//   2. write its strategy file in this folder,
//   3. add one entry to the map.
// The evaluator, the message builder and the UI never change (OCP).
//
// Explicit imports on purpose — this folder is consumed from shared/
// code that runs on BOTH client and server, where Nitro auto-imports
// don't exist.

import { ConditionOperator } from "../../types/condition";
import type { OperatorStrategy } from "../../types/operatorStrategy";
import { changedStrategy } from "./changedStrategy";
import { equalsStrategy } from "./equalsStrategy";
import { greaterThanStrategy } from "./greaterThanStrategy";
import { lessThanStrategy } from "./lessThanStrategy";
import { containsStrategy } from "./containsStrategy";
import { regExpStrategy } from "./regExpStrategy";

const strategies: Record<ConditionOperator, OperatorStrategy> = {
  [ConditionOperator.Changed]: changedStrategy,
  [ConditionOperator.Equals]: equalsStrategy,
  [ConditionOperator.GreaterThan]: greaterThanStrategy,
  [ConditionOperator.LessThan]: lessThanStrategy,
  [ConditionOperator.Contains]: containsStrategy,
  [ConditionOperator.RegExp]: regExpStrategy,
};

export const operatorFactory = {
  /** Null for unknown operators — the caller degrades to a non-firing
   *  verdict with a diagnostic detail instead of crashing the poll. */
  forOperator(operator: ConditionOperator): OperatorStrategy | null {
    return strategies[operator] ?? null;
  },
};
