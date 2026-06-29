// Normalisation + compaction for PollingCondition.
//
//   migrateCondition  — accept any incoming shape (DB row, API payload,
//                       UI draft) and return a fully-populated
//                       PollingCondition. Missing fields get defaults.
//                       Unknown shapes fall back to "None".
//
//   compactCondition  — strip fields that are meaningless given the kind
//                       (e.g. `paths` when kind === None) for DB
//                       persistence. The in-memory shape ALWAYS carries
//                       every field so the UI can flip between Rule and
//                       None without losing the user's in-progress
//                       configuration; this function bakes the final
//                       state for storage.
//
//   blankCondition    — a brand-new, valid-but-empty PollingCondition.
//                       Used when seeding a new alert.

import {
  ConditionAggregation,
  ConditionKind,
  ConditionOperator,
  OPERATORS_NEEDING_VALUE,
  type PollingCondition,
} from "../types/condition";

export const blankCondition = (): PollingCondition => ({
  kind: ConditionKind.None,
  paths: [],
  operator: ConditionOperator.Changed,
  aggregation: ConditionAggregation.All,
});

export function migrateCondition(c: any): PollingCondition {
  const out = blankCondition();
  if (!c || typeof c !== "object") return out;

  out.kind =
    c.kind === ConditionKind.Rule || c.kind === ConditionKind.None
      ? c.kind
      : ConditionKind.None;
  if (Array.isArray(c.paths)) out.paths = c.paths.filter(Boolean);
  if (c.operator) out.operator = c.operator as ConditionOperator;
  if (typeof c.value === "string") out.value = c.value;
  if (c.aggregation) out.aggregation = c.aggregation as ConditionAggregation;

  return out;
}

export function compactCondition(c: PollingCondition): any {
  if (c.kind === ConditionKind.None) {
    return { kind: ConditionKind.None };
  }
  const out: any = {
    kind: ConditionKind.Rule,
    paths: c.paths,
    operator: c.operator,
    aggregation: c.aggregation,
  };
  if (OPERATORS_NEEDING_VALUE.has(c.operator) && c.value) {
    out.value = c.value;
  }
  return out;
}
