// Contract for a condition-aggregation strategy (Strategy pattern).
//
// Each ConditionAggregation value ships one object implementing one of
// the two flavours below, registered in
// `shared/condition/aggregators/aggregatorFactory.ts`.
//
// The evaluator dispatches ONCE on `kind`:
//
//   boolean → the operator strategy runs on EVERY observed value; the
//             aggregator combines the resulting booleans (All → AND,
//             Any → OR). One verdict per path.
//
//   numeric → the aggregator first collapses every numeric observed
//             value into a single number (Sum, Average, Minimum,
//             Maximum); the operator strategy then evaluates that one
//             result against the threshold. One synthetic verdict.
//
// Same file-per-strategy + factory shape as operators and dispatchers.

import type { ConditionAggregation } from "./condition";

export interface BooleanAggregatorStrategy {
  readonly aggregation: ConditionAggregation;
  readonly kind: "boolean";
  /** Combine per-path verdict booleans into the final fired flag. */
  combine(flags: boolean[]): boolean;
}

export interface NumericAggregatorStrategy {
  readonly aggregation: ConditionAggregation;
  readonly kind: "numeric";
  /** Short lowercase name used in verdict paths and details ("sum",
   *  "average", …). */
  readonly label: string;
  /** Reduce a NON-EMPTY list of numbers to the aggregate. The evaluator
   *  guards the empty case before calling. */
  collapse(values: number[]): number;
}

export type AggregatorStrategy =
  | BooleanAggregatorStrategy
  | NumericAggregatorStrategy;
