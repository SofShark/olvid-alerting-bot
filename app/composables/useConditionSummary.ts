import {
  ConditionAggregation,
  ConditionKind,
  ConditionOperator,
  OPERATORS_NEEDING_VALUE,
} from "#shared/types/condition";
import { migrateCondition } from "#shared/condition/migrate";

/**
 * Builds the human-readable summary of a polling condition shown in the
 * view-mode "Condition" row of AlertEditor.
 *
 * Output shape: `{ headline, paths }`
 *   - `headline` is a localised sentence such as
 *     "Fires when the sum of these fields is greater than 100."
 *   - `paths`    is the list of watched dot-paths (rendered as code chips).
 *
 * Grammar: the headline composes `{subject} {phrase}` where the subject
 * comes from the aggregation ("all of these fields", "the sum of these
 * fields", …) and the phrase from the operator. Boolean aggregations
 * (All/Any) take PLURAL operator phrases ("are greater than"); numeric
 * reducers (Sum/Average/Min/Max) collapse to one value and take the
 * SINGULAR variants ("is greater than").
 */
export const useConditionSummary = () => {
  const { t } = useI18n();

  const isNumericAggregation = (a: ConditionAggregation): boolean =>
    a !== ConditionAggregation.All && a !== ConditionAggregation.Any;

  // Operator → translated phrase. `singular` picks the verb form that
  // agrees with a collapsed (single-value) subject.
  const operatorPhrase = (
    op: ConditionOperator,
    v?: string,
    singular = false,
  ): string => {
    const value = v ?? "";
    const ns = singular ? "phraseSingular" : "phrase";
    switch (op) {
      case ConditionOperator.Changed:
        return t(`editor.condition.${ns}.changed`);
      case ConditionOperator.Equals:
        return t(`editor.condition.${ns}.equals`, { value });
      case ConditionOperator.GreaterThan:
        return t(`editor.condition.${ns}.greaterThan`, { value });
      case ConditionOperator.LessThan:
        return t(`editor.condition.${ns}.lessThan`, { value });
      case ConditionOperator.Contains:
        return t(`editor.condition.${ns}.contains`, { value });
      default:
        return String(op);
    }
  };

  const conditionSummary = (
    rawCondition: any,
  ): { headline: string; paths: string[] } => {
    const c = migrateCondition(rawCondition);

    if (c.kind === ConditionKind.None) {
      return { headline: t("editor.condition.summaryNone"), paths: [] };
    }
    if (c.kind === ConditionKind.Rule) {
      const numeric = isNumericAggregation(c.aggregation);
      const subject = t(`editor.condition.subject.${c.aggregation}`);
      const phrase = operatorPhrase(c.operator, c.value, numeric);
      const needsValue = OPERATORS_NEEDING_VALUE.has(c.operator) && !c.value;
      const key = needsValue
        ? "editor.condition.summaryRuleMissingValue"
        : "editor.condition.summaryRule";
      return { headline: t(key, { subject, phrase }), paths: c.paths ?? [] };
    }
    return { headline: t("common.emDash"), paths: [] };
  };

  return { conditionSummary, operatorPhrase };
};
