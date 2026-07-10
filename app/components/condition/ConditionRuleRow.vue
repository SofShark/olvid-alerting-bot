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
    - Operator options come from the useConditionOperators composable
      (single source of truth for the enum ↔ i18n mapping).
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

const needsValue = computed(() => OPERATORS_NEEDING_VALUE.has(props.operator));
const { options: OPERATORS } = useConditionOperators();
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
/* Reads left-to-right like a query editor sentence:
 *   TRIGGER WHEN  [agg]  [operator]  [value]
 * All three controls share the same 32px height + border so they
 * compose visually as one continuous control, not three loose widgets. */
.rule-row.inline {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.rule-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
  flex-shrink: 0;
}

.rule-select,
.rule-input {
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-sm);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rule-select {
  cursor: pointer;
  /* Chevron indicator instead of the browser-native arrow — matches
   * the app's other tech-tool selects (Grafana / Linear style). */
  appearance: none;
  -webkit-appearance: none;
  padding-right: calc(var(--space-3) + 16px);
  background-image: linear-gradient(45deg, transparent 50%, var(--color-text-dim) 50%),
    linear-gradient(135deg, var(--color-text-dim) 50%, transparent 50%);
  background-position:
    calc(100% - 12px) 50%,
    calc(100% - 7px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
.rule-select:hover,
.rule-input:hover {
  border-color: var(--color-border-strong);
}
.rule-select:focus,
.rule-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.rule-select.agg {
  min-width: 120px;
}
.rule-select.op {
  min-width: 200px;
}
.rule-input {
  min-width: 120px;
  flex: 1 1 120px;
  font-family: var(--font-mono);
}
</style>
