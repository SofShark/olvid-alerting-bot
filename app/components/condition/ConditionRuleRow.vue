<script setup lang="ts">
import { computed } from "vue";
import {
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  inputTypeForOperator,
} from "#shared/types/condition";
import { orderedAggregations } from "#shared/condition/aggregators/aggregatorFactory";

/*
  The "Trigger — [aggregation] [operator] [value]" row of the polling
  ConditionEditor. Three interlinked inputs whose options and shapes
  depend on each other:

    - Aggregation options come from the aggregator factory (All / Any /
      Sum / Average / Minimum / Maximum).
    - Operator options are the fixed enum values.
    - Value input is shown only when the operator needs one; its input
      type (number / text) also depends on the operator.

  Owns no state — every change is emitted through a single
  `patch` event that carries a partial PollingCondition.
*/

const props = defineProps<{
  aggregation: ConditionAggregation;
  operator: ConditionOperator;
  value: string;
}>();

const emit = defineEmits<{
  (
    e: "patch",
    v: Partial<{
      aggregation: ConditionAggregation;
      operator: ConditionOperator;
      value: string;
    }>,
  ): void;
}>();

const { t } = useI18n();

const needsValue = computed(() => OPERATORS_NEEDING_VALUE.has(props.operator));

/** Operator dropdown options — labels resolve at render so they
 *  re-translate on locale change. */
const OPERATORS = computed<Array<{ value: ConditionOperator; label: string }>>(
  () => [
    {
      value: ConditionOperator.Changed,
      label: t("conditionEditor.operator.changed"),
    },
    {
      value: ConditionOperator.Equals,
      label: t("conditionEditor.operator.equals"),
    },
    {
      value: ConditionOperator.GreaterThan,
      label: t("conditionEditor.operator.greaterThan"),
    },
    {
      value: ConditionOperator.LessThan,
      label: t("conditionEditor.operator.lessThan"),
    },
    {
      value: ConditionOperator.Contains,
      label: t("conditionEditor.operator.contains"),
    },
  ],
);
</script>

<template>
  <div class="rule-row inline">
    <span class="rule-label">{{ $t("conditionEditor.trigger.label") }}</span>

    <!-- Aggregation — options from the factory so new aggregators
         appear here without touching this file. -->
    <select
      class="rule-select agg"
      :value="aggregation"
      @change="
        emit('patch', {
          aggregation: ($event.target as HTMLSelectElement)
            .value as ConditionAggregation,
        })
      "
    >
      <option v-for="a in orderedAggregations" :key="a" :value="a">
        {{ $t(`conditionEditor.aggregation.${a}`) }}
      </option>
    </select>

    <!-- Operator — fixed enum, labels via i18n. -->
    <select
      class="rule-select op"
      :value="operator"
      @change="
        emit('patch', {
          operator: ($event.target as HTMLSelectElement)
            .value as ConditionOperator,
        })
      "
    >
      <option v-for="o in OPERATORS" :key="o.value" :value="o.value">
        {{ o.label }}
      </option>
    </select>

    <!-- Value — only when the operator uses one. Input type follows the
         operator (numeric for GreaterThan/LessThan, text for Equals/
         Contains). Changed operator hides the input entirely. -->
    <input
      v-if="needsValue"
      :type="inputTypeForOperator(operator)"
      :step="inputTypeForOperator(operator) === 'number' ? 'any' : undefined"
      class="rule-input"
      :value="value"
      :placeholder="$t('conditionEditor.value.placeholder')"
      @input="
        emit('patch', {
          value: ($event.target as HTMLInputElement).value,
        })
      "
    >
  </div>
</template>

<style scoped>
.rule-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.rule-row.inline {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.rule-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
  margin-right: var(--space-1);
}

.rule-select,
.rule-input {
  padding: 6px var(--space-3);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-md);
  outline: none;
  transition: border-color 0.15s;
}
.rule-select {
  cursor: pointer;
}
.rule-select:focus,
.rule-input:focus {
  border-color: var(--color-accent);
}
.rule-select.agg {
  min-width: 110px;
}
.rule-select.op {
  min-width: 200px;
  flex: 1 1 auto;
}
.rule-input {
  min-width: 120px;
  flex: 1 1 120px;
}
</style>
