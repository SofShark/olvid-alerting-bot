<script setup lang="ts">
import { computed } from "vue";
import type { TriggerMode } from "#shared/types/triggerMode";

/*
  Segmented pill radio for the three TriggerMode options. Visually
  matches ConditionKindPicker (polling) and the kind-row of
  StatusMatchEditor (monitoring) so the entire trigger step reads as
  one consistent widget family.

  Consumers:
    · FiringBehaviorPanel (both polling + monitoring)

  Two hint variants because polling/monitoring phrase the same three
  modes slightly differently — the composable owns that mapping.
*/

const model = defineModel<TriggerMode>({ required: true });

const props = withDefaults(
  defineProps<{
    /** Which hint set to use — "polling" (default) or "monitoring". */
    variant?: "polling" | "monitoring";
    /** Hide the hint row (e.g. when the caller wants a compact picker). */
    showHint?: boolean;
  }>(),
  { variant: "polling", showHint: true },
);

const { triggerModeOptions, triggerModeHint } = useAlertLabels();
const options = triggerModeOptions(props.variant);

const activeHint = computed(() =>
  triggerModeHint(model.value, props.variant),
);
</script>

<template>
  <div class="trigger-mode">
    <div class="btn-pill-group">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="btn-pill"
        :class="{ active: model === opt.value }"
        @click="model = opt.value"
      >
        <input type="radio" :checked="model === opt.value" />
        <span>{{ opt.label }}</span>
      </button>
    </div>
    <p v-if="showHint" class="trigger-mode-hint">{{ activeHint }}</p>
  </div>
</template>

<style scoped>
.trigger-mode {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trigger-mode-pills {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Same shape as .kind in ConditionKindPicker so the two picker rows
 * line up visually when stacked. Local class name (.pill) to avoid
 * global collisions. */
.pill {
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

.trigger-mode-hint {
  margin: 0;
  color: var(--color-text-dim);
  font-size: var(--text-md);
  line-height: 1.5;
}
</style>
