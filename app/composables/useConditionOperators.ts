import { computed } from "vue";
import { ConditionOperator } from "#shared/types/condition";

/**
 * Catalog of ConditionOperator options with human-readable labels.
 *
 * Ownership boundary: this composable owns the enum ↔ i18n mapping and
 * the display order. ConditionRuleRow.vue just renders whatever comes
 * back. Analogous to `orderedAggregations` (which lives in the aggregator
 * factory) — kept out of the component so adding/removing an operator or
 * changing the display order doesn't touch presentation code.
 *
 * Labels reactively re-translate on locale change (computed over `t`).
 */
export const useConditionOperators = () => {
  const { t } = useI18n();

  const options = computed<Array<{ value: ConditionOperator; label: string }>>(() => [
    { value: ConditionOperator.Changed, label: t("conditionEditor.operator.changed") },
    { value: ConditionOperator.Equals, label: t("conditionEditor.operator.equals") },
    { value: ConditionOperator.GreaterThan, label: t("conditionEditor.operator.greaterThan") },
    { value: ConditionOperator.LessThan, label: t("conditionEditor.operator.lessThan") },
    { value: ConditionOperator.Contains, label: t("conditionEditor.operator.contains") },
    { value: ConditionOperator.RegExp, label: t("conditionEditor.operator.regExp") },
  ]);

  return { options };
};
