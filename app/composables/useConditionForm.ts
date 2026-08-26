import { computed, type ComputedRef } from "vue";
import {
  ConditionKind,
  OPERATORS_NEEDING_VALUE,
  type PollingCondition,
} from "#shared/types/condition";
import { paramCleaner } from "~~/shared/condition/paramCleaner";
import { expandPath, hasWildcard } from "#shared/condition/pathExpand";

/**
 * Owns the CONDITION form model: normalises the incoming value, exposes
 * derived flat fields (kind/paths/operator/…), and centralises every
 * mutation. Every write goes through `patchRule` / `setKind`, so the
 * component template only reads and calls named actions — never
 * spreads a partial into an emit itself.
 *
 * Ownership boundary: this composable owns "what the condition currently
 * is + how it changes". Fetching, evaluation, and presentation live
 * elsewhere (useSourceRetrieve, useConditionVerdict, VerdictStrip).
 *
 * @param sourceGetter   Reactive getter for the raw `PollingCondition`
 *                       coming in through v-model.
 * @param parsedGetter   Reactive getter for the parsed source snapshot
 *                       (null when not retrieved). Used to expand
 *                       wildcards for the `effectivePaths` chip count.
 * @param onChange       Fires with the new condition after every
 *                       mutation — parent's `emit("update:modelValue")`.
 */
export const useConditionForm = (
  sourceGetter: () => PollingCondition | undefined,
  parsedGetter: () => unknown,
  onChange: (next: PollingCondition) => void,
) => {
  const current: ComputedRef<PollingCondition> = computed(() =>
    paramCleaner.migrateCondition(sourceGetter()),
  );

  const kind = computed(() => current.value.kind);
  const paths = computed(() => current.value.paths);
  const operator = computed(() => current.value.operator);
  const literal = computed(() => current.value.value ?? "");
  const aggregation = computed(() => current.value.aggregation);
  const needsValue = computed(() =>
    OPERATORS_NEEDING_VALUE.has(operator.value),
  );

  /** Chips as the user typed them (may contain wildcards) expanded to
   *  the concrete leaf set they resolve to against the current snapshot.
   *  Falls back to the literal non-wildcard set when nothing is parsed. */
  const effectivePaths = computed<string[]>(() => {
    const parsed = parsedGetter();
    if (!parsed) {
      return [...new Set(paths.value.filter((p) => !hasWildcard(p)))];
    }
    const set = new Set<string>();
    for (const p of paths.value) {
      if (hasWildcard(p)) {
        for (const c of expandPath(p, parsed)) set.add(c);
      } else {
        set.add(p);
      }
    }
    return [...set];
  });

  /** Emit a merged condition with `kind: Rule` — used by any change that
   *  implicitly requires the rule branch (touching paths, operator, value). */
  function patchRule(patch: Partial<PollingCondition>) {
    onChange({ ...current.value, ...patch, kind: ConditionKind.Rule });
  }

  /** Flip kind without touching other fields. Preserves the user's
   *  in-progress selections when toggling None ⇄ Rule; paramCleaner.compactCondition()
   *  at save time drops them if the final kind is None. */
  function setKind(next: ConditionKind) {
    if (kind.value === next) return;
    onChange({ ...current.value, kind: next });
  }

  function addPath(path: string) {
    if (paths.value.includes(path)) return;
    patchRule({ paths: [...paths.value, path] });
  }

  function removePath(path: string) {
    patchRule({ paths: paths.value.filter((p) => p !== path) });
  }

  /** Picker-tree clicks. Three cases:
   *    (a) already a concrete chip → remove it.
   *    (b) covered by a wildcard chip → silent no-op (removing the leaf
   *        would have to break the wildcard, too destructive).
   *    (c) not on the list at all → add as a concrete chip. */
  function toggleTreePath(path: string) {
    if (paths.value.includes(path)) {
      removePath(path);
      return;
    }
    if (effectivePaths.value.includes(path)) return;
    addPath(path);
  }

  return {
    current,
    kind,
    paths,
    operator,
    literal,
    aggregation,
    needsValue,
    effectivePaths,
    patchRule,
    setKind,
    addPath,
    removePath,
    toggleTreePath,
  };
};
