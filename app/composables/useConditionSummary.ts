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
 *   - `headline` is a localised sentence such as "Any of 3 fields changed".
 *   - `paths`    is the list of watched dot-paths (rendered as code chips).
 *
 * The condition arrives as a `PollingCondition` from `alertParams.condition`
 * — possibly in its compact form (kind === None). `migrateCondition` is
 * applied internally so callers can pass anything they have on hand.
 */
export const useConditionSummary = () => {
  const { t } = useI18n();

  // Operator → translated phrase. Used as a stitching piece inside the
  // summary headline. `value` is interpolated by vue-i18n placeholders;
  // operators that don't need a value ignore it.
  const operatorPhrase = (op: ConditionOperator, v?: string): string => {
    const value = v ?? "";
    switch (op) {
      case ConditionOperator.Changed:
        return t("editor.condition.phrase.changed");
      case ConditionOperator.Equals:
        return t("editor.condition.phrase.equals", { value });
      case ConditionOperator.GreaterThan:
        return t("editor.condition.phrase.greaterThan", { value });
      case ConditionOperator.LessThan:
        return t("editor.condition.phrase.lessThan", { value });
      case ConditionOperator.Contains:
        return t("editor.condition.phrase.contains", { value });
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
      const isAny = c.aggregation === ConditionAggregation.Any;
      const phrase = operatorPhrase(c.operator, c.value);
      const needsValue = OPERATORS_NEEDING_VALUE.has(c.operator) && !c.value;
      const key = needsValue
        ? isAny
          ? "editor.condition.summaryRuleAnyMissingValue"
          : "editor.condition.summaryRuleAllMissingValue"
        : isAny
          ? "editor.condition.summaryRuleAny"
          : "editor.condition.summaryRuleAll";
      return { headline: t(key, { phrase }), paths: c.paths ?? [] };
    }
    return { headline: t("common.emDash"), paths: [] };
  };

  return { conditionSummary, operatorPhrase };
};
