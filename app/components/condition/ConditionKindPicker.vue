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
  <div class="btn-pill-group">
    <button
      type="button"
      class="btn-pill"
      :class="{ active: modelValue === ConditionKind.None }"
      @click="$emit('update:modelValue', ConditionKind.None)"
    >
      <input type="radio" :checked="modelValue === ConditionKind.None" />
      <span>{{ $t("conditionEditor.mode.none") }}</span>
    </button>
    <button
      type="button"
      class="btn-pill"
      :class="{ active: modelValue === ConditionKind.Rule }"
      @click="$emit('update:modelValue', ConditionKind.Rule)"
    >
      <input type="radio" :checked="modelValue === ConditionKind.Rule" />
      <span>{{ $t("conditionEditor.mode.rule") }}</span>
    </button>
  </div>
</template>
