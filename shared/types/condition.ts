// Condition under which a polling alert actually fires. Three independent
// axes that combine into one rule:
//
//   - ConditionKind        ─ "is there a rule at all?" (None vs Rule).
//   - ConditionOperator    ─ how to compare the observed value to the threshold.
//   - ConditionAggregation ─ when the rule watches multiple paths, do ALL
//                            of them need to pass (All) or just one (Any)?
//
// `PollingCondition` is the homogeneous storage shape: every field is always
// present, even when not currently meaningful (e.g. `value` is unused for
// the `Changed` operator). The compact form for DB persistence is produced
// by `compactCondition` (lives in shared/condition/migrate.ts).

export const ConditionKind = {
  None: "none",
  Rule: "rule",
} as const;
export type ConditionKind = (typeof ConditionKind)[keyof typeof ConditionKind];

export const ConditionOperator = {
  Changed: "changed", // value differs from previous poll's snapshot
  Equals: "equals", // value === literal
  GreaterThan: "greater_than", // numeric comparison
  LessThan: "less_than",
  Contains: "contains", // substring match on string value
} as const;
export type ConditionOperator =
  (typeof ConditionOperator)[keyof typeof ConditionOperator];

export const ConditionAggregation = {
  All: "all", // every path must verify   (logical AND)
  Any: "any", // at least one path        (logical OR)
} as const;
export type ConditionAggregation =
  (typeof ConditionAggregation)[keyof typeof ConditionAggregation];

// Operators that need a literal value to compare against. `Changed` doesn't —
// it's always compared to the previous poll's snapshot.
export const OPERATORS_NEEDING_VALUE: ReadonlySet<ConditionOperator> = new Set([
  ConditionOperator.Equals,
  ConditionOperator.GreaterThan,
  ConditionOperator.LessThan,
  ConditionOperator.Contains,
]);

// ── Data shape ─────────────────────────────────────────────────────────────

export type PollingCondition = {
  kind: ConditionKind;
  paths: string[]; // dot-paths or wildcard patterns
  operator: ConditionOperator; // unused (but preserved) when kind === None
  value?: string; // unused for `changed` and for kind === None
  aggregation: ConditionAggregation; // unused (but preserved) when kind === None
};
