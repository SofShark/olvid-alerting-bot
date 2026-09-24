import { computed, type MaybeRefOrGetter, toValue } from "vue";
import {
  ConditionOperator,
  OPERATORS_NEEDING_VALUE,
} from "#shared/types/condition";
import { orderedAggregations } from "~~/shared/condition/aggregators/aggregatorFactory";
import { orderedOperators } from "~~/shared/condition/operators/operatorFactory";

/**
 * Reactive catalog + validation for the ConditionRuleRow.
 *
 * Ownership boundary: this composable owns the enum ↔ i18n mapping, the
 * display order, and the "is this value entry valid?" rule. The row
 * component just renders what comes back.
 *
 * Inputs are declared `MaybeRefOrGetter` so the caller can hand in
 * `() => props.operator` and `() => props.value` (or refs). Passing plain
 * values would flatten reactivity — the internal computeds read them
 * through `toValue`, so every downstream computed updates on prop change.
 *
 * Labels reactively re-translate on locale change (computed over `t`).
 */
export const useConditionOptions = (
  operator: () => ConditionOperator,
  value: () => string,
) => {
  const { t } = useI18n();

  const aggregationOptions = computed(() =>
    orderedAggregations.map((a) => ({
      value: a,
      label: t(`conditionEditor.aggregation.${a}`),
    })),
  );

  const operatorOptions = computed(() =>
    orderedOperators.map((o) => ({
      value: o,
      label: t(`conditionEditor.operator.${o}`),
    })),
  );

  const needsValue = computed(() =>
    OPERATORS_NEEDING_VALUE.has(toValue(operator)),
  );

  // Flag the value input when theres a mistake
  //   - RegExp -> pattern doesn't compile with new RegExp(v).
  //   - GreaterThan / LessThan -> not a finite number.
  //   - Equals / Contains -> always accepted (any string compares).
  // Empty values are not flagged: the user hasn't finished typing yet.
  const inputError = computed(() => {
    if (!needsValue.value) return false;
    const v = toValue(value);
    if (!v) return false;
    const op = toValue(operator);
    if (op === ConditionOperator.RegExp) {
      try {
        new RegExp(v);
        return false;
      } catch {
        return true;
      }
    }
    if (
      op === ConditionOperator.GreaterThan ||
      op === ConditionOperator.LessThan
    ) {
      // Any non-numeric junk (arithmetic operators, letters, stray
      // punctuation) makes Number(v) → NaN, which the evaluator later
      // treats as "no value" and refuses to fire. Flag it up front so
      // the user sees a red border instead of a silent no-op.
      return !Number.isFinite(Number(v));
    }
    return false;
  });

  return { aggregationOptions, operatorOptions, needsValue, inputError };
};
