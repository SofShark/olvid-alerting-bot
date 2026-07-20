<script setup lang="ts">
import { computed } from "vue";
import {
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  inputTypeForOperator,
} from "#shared/types/condition";
import { orderedAggregations } from "#shared/condition/aggregators/aggregatorFactory";
import { useI18n } from "vue-i18n";

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

const { t } = useI18n();
const aggregationOptions = computed(() =>
  orderedAggregations.map((a) => ({
    value: a,
    label: t(`conditionEditor.aggregation.${a}`),
  })),
);
</script>

<template>
  <div class="rule-row inline">
    <span class="rule-label">{{ $t("conditionEditor.trigger.label") }}</span>

    <!-- Aggregation — options from the factory so new aggregators
         appear here without touching this file. -->
    <Select
      :model-value="aggregation"
      :options="aggregationOptions"
      size="sm"
      class="rule-select agg"
      @update:model-value="
        emit('patch', { aggregation: $event as ConditionAggregation })
      "
    />

    <!-- Operator — fixed enum, labels via i18n. -->
    <Select
      :model-value="operator"
      :options="OPERATORS"
      size="sm"
      class="rule-select op"
      @update:model-value="
        emit('patch', { operator: $event as ConditionOperator })
      "
    />

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

/* .rule-select is the wrapper of the shared <Select> component; it must
 * NOT redraw its own border/chevron/background — the Select handles
 * those. Width is left auto so the trigger hugs its label with no
 * empty gap between label and chevron. Row gap comes from .rule-row. */

.rule-input {
  padding: var(--space-3);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rule-input:hover {
  border-color: var(--color-border-strong);
}
.rule-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.rule-input {
  min-width: 120px;
  flex: 1 1 120px;

}
</style>
