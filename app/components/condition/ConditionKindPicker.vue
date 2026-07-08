<script setup lang="ts">
import { ConditionKind } from "#shared/types/condition";

/*
  Pill-radio pair that flips a polling condition between "fire every
  poll" (None) and "match a rule" (Rule). Owns no state; parent
  re-emits every pick through v-model.
*/

defineProps<{
  modelValue: ConditionKind;
}>();

defineEmits<{ (e: "update:modelValue", v: ConditionKind): void }>();
</script>

<template>
  <div class="kind-picker">
    <label class="kind" :class="{ active: modelValue === ConditionKind.None }">
      <input
        type="radio"
        :checked="modelValue === ConditionKind.None"
        @change="$emit('update:modelValue', ConditionKind.None)"
      >
      <span>{{ $t("conditionEditor.mode.none") }}</span>
    </label>
    <label class="kind" :class="{ active: modelValue === ConditionKind.Rule }">
      <input
        type="radio"
        :checked="modelValue === ConditionKind.Rule"
        @change="$emit('update:modelValue', ConditionKind.Rule)"
      >
      <span>{{ $t("conditionEditor.mode.rule") }}</span>
    </label>
  </div>
</template>

<style scoped>
.kind-picker {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.kind {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 7px var(--space-4);
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.kind:hover {
  border-color: var(--color-border-strong);
}
.kind.active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-text-primary);
}
.kind input[type="radio"] {
  accent-color: var(--color-accent);
  cursor: pointer;
}
</style>
