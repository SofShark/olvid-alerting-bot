/**
 * Centralized polling-condition evaluation. The single place that knows how
 * to: resolve dot-paths, expand wildcard patterns, evaluate operators, and
 * aggregate per-path verdicts. Pure function — no IO, no DOM — safe to call
 * from the Vue side (preview), the server side (engine), or anywhere else.
 *
 * Consumers:
 *   - ConditionEditor              → per-path verdicts for the live preview.
 *   - buildPollingDefaultMessage   → which paths fired + observed values.
 *   - server polling evaluator     → real evaluation against a baseline.
 *
 * Wildcards: any chip whose path contains `..` is expanded against `payload`
 * before evaluation. So one wildcard chip can produce many verdicts. A
 * pattern that matches nothing surfaces as a single non-firing verdict
 * (so it's visible in the breakdown, not vacuously dropped).
 */

import {
  ConditionAggregation,
  ConditionKind,
  ConditionOperator,
  OPERATORS_NEEDING_VALUE,
  type PollingCondition,
} from "../types/condition";
import { migrateCondition } from "./migrate";
import { expandPath, hasWildcard } from "./pathExpand";

/** One verdict per concrete (post-expansion) path. */
export type Verdict = {
  path: string;
  fired: boolean;
  observed: any;
  baseline?: any;
  detail: string;
};

/** Full result of evaluating a condition against a payload. */
export type EvaluationResult = {
  /** Pulled from the (migrated) condition for convenience — callers often branch on this first. */
  kind: ConditionKind;
  /** Aggregate truth across all verdicts, per condition.aggregation. */
  fired: boolean;
  /** Human-readable summary for UI / logs. */
  reason: string;
  /** Per-path breakdown. Empty when kind=None or when no paths configured. */
  verdicts: Verdict[];
  /** Normalized condition (after `migrateCondition`) — saves the caller from re-running it. */
  condition: PollingCondition;
};

// ── Internal helpers (single source of truth, no duplication elsewhere) ────

export function resolvePath(obj: any, path: string): any {
  if (!path) return undefined;
  // filter(Boolean) drops empty segments — important for wildcard patterns
  // that have already been expanded into concrete paths. Concrete paths
  // shouldn't have empty segments anyway, but this is defensive.
  const parts = path.split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function asNumbers(a: any, b: any): [number, number] | null {
  if (a === null || a === undefined || a === "") return null;
  if (b === null || b === undefined || b === "") return null;
  const na = Number(a),
    nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return null;
  return [na, nb];
}

/** Evaluate a single concrete path against an observed value (and optional baseline). */
function evalOne(
  operator: ConditionOperator,
  threshold: string | undefined,
  observed: any,
  baseline: any | undefined,
): { fired: boolean; detail: string } {
  switch (operator) {
    case ConditionOperator.Changed: {
      // No baseline → treat as "would fire when next change happens". This
      // is the right answer for previews; the server evaluator passes a
      // real baseline at poll time so this branch only triggers in the UI.
      if (baseline === undefined) {
        return {
          fired: true,
          detail: "would fire on next change (no baseline yet)",
        };
      }
      const changed = !deepEqual(observed, baseline);
      return {
        fired: changed,
        detail: changed
          ? "changed since last poll"
          : "unchanged since last poll",
      };
    }
    case ConditionOperator.Equals: {
      const fired = String(observed ?? "") === String(threshold ?? "");
      return {
        fired,
        detail: fired
          ? `equals "${threshold}"`
          : `is "${observed}" (expected "${threshold}")`,
      };
    }
    case ConditionOperator.GreaterThan: {
      const nums = asNumbers(observed, threshold);
      if (!nums)
        return {
          fired: false,
          detail: `non-numeric: "${observed}" or "${threshold}"`,
        };
      const fired = nums[0] > nums[1];
      return {
        fired,
        detail: fired ? `${nums[0]} > ${nums[1]}` : `${nums[0]} ≤ ${nums[1]}`,
      };
    }
    case ConditionOperator.LessThan: {
      const nums = asNumbers(observed, threshold);
      if (!nums)
        return {
          fired: false,
          detail: `non-numeric: "${observed}" or "${threshold}"`,
        };
      const fired = nums[0] < nums[1];
      return {
        fired,
        detail: fired ? `${nums[0]} < ${nums[1]}` : `${nums[0]} ≥ ${nums[1]}`,
      };
    }
    case ConditionOperator.Contains: {
      const hay = String(observed ?? "");
      const ndl = String(threshold ?? "");
      const fired = ndl.length > 0 && hay.includes(ndl);
      return {
        fired,
        detail: fired ? `contains "${ndl}"` : `does not contain "${ndl}"`,
      };
    }
    default:
      return { fired: false, detail: `unknown operator: ${operator}` };
  }
}

/**
 * Evaluate a polling condition against a parsed payload.
 *
 * @param rawCondition  The raw condition from alertParams (any shape — migrated internally).
 * @param payload       The parsed source object (parsed XML tree, JSON body, etc.).
 * @param baseline      Optional previous-poll snapshot for `changed` comparisons.
 *                      Omit for previews; required server-side for accurate Changed evaluation.
 */
export function evaluateCondition(
  rawCondition: any,
  payload: any,
  baseline?: any,
): EvaluationResult {
  const condition = migrateCondition(rawCondition);

  // No-condition case — fires every poll cycle by definition.
  if (condition.kind === ConditionKind.None) {
    return {
      kind: ConditionKind.None,
      fired: true,
      reason: "No condition — fires every poll cycle.",
      verdicts: [],
      condition,
    };
  }

  if (condition.paths.length === 0) {
    return {
      kind: condition.kind,
      fired: false,
      reason: "No fields selected.",
      verdicts: [],
      condition,
    };
  }

  if (OPERATORS_NEEDING_VALUE.has(condition.operator) && !condition.value) {
    return {
      kind: condition.kind,
      fired: false,
      reason: `Operator "${condition.operator}" needs a value.`,
      verdicts: [],
      condition,
    };
  }

  // Expand wildcard patterns into concrete paths against the CURRENT payload.
  // One wildcard chip ("..temperatura.maxima") becomes one verdict per match
  // ("dia.0.temperatura.maxima", "dia.1.…", …). New array entries between
  // polls are picked up automatically — we re-expand every time.
  const verdicts: Verdict[] = condition.paths.flatMap((pathOrPattern) => {
    if (!hasWildcard(pathOrPattern)) {
      const observed = resolvePath(payload, pathOrPattern);
      const prev =
        baseline === undefined
          ? undefined
          : resolvePath(baseline, pathOrPattern);
      const { fired, detail } = evalOne(
        condition.operator,
        condition.value,
        observed,
        prev,
      );
      return [{ path: pathOrPattern, fired, observed, baseline: prev, detail }];
    }
    const concretes = expandPath(pathOrPattern, payload);
    if (concretes.length === 0) {
      return [
        {
          path: pathOrPattern,
          fired: false,
          observed: undefined,
          baseline: undefined,
          detail: "pattern matched no paths in the current source",
        },
      ];
    }
    return concretes.map((concretePath) => {
      const observed = resolvePath(payload, concretePath);
      const prev =
        baseline === undefined
          ? undefined
          : resolvePath(baseline, concretePath);
      const { fired, detail } = evalOne(
        condition.operator,
        condition.value,
        observed,
        prev,
      );
      return { path: concretePath, fired, observed, baseline: prev, detail };
    });
  });

  // Aggregate over the post-expansion verdicts. "All of N" means "every
  // concrete path the wildcards resolved to must fire" — the meaningful
  // semantics, not "all chips fired" (which would ignore expansion).
  const aggregation = condition.aggregation ?? ConditionAggregation.All;
  const fired =
    aggregation === ConditionAggregation.All
      ? verdicts.every((v) => v.fired)
      : verdicts.some((v) => v.fired);

  const firedCount = verdicts.filter((v) => v.fired).length;
  const total = verdicts.length;
  const reason = `${aggregation === ConditionAggregation.All ? "All" : "Any"} of ${total} field${total === 1 ? "" : "s"} — ${firedCount}/${total} verified.`;

  return { kind: condition.kind, fired, reason, verdicts, condition };
}
