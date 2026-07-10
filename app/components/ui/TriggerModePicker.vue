<script setup lang="ts">
import { computed } from "vue";
import { TriggerMode } from "#shared/types/polling";

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

const { options, hintFor } = useTriggerModeOptions(props.variant);

const activeHint = computed(() => hintFor(model.value));
</script>

<template>
  <div class="trigger-mode">
    <div class="trigger-mode-pills">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="pill"
        :class="{ active: model === opt.value }"
      >
        <input
          type="radio"
          :checked="model === opt.value"
          @change="model = opt.value"
        >
        <span>{{ opt.label }}</span>
      </label>
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
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.pill:hover {
  border-color: var(--color-border-strong);
}
.pill.active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-text-primary);
}
.pill input[type="radio"] {
  accent-color: var(--color-accent);
  cursor: pointer;
}

.trigger-mode-hint {
  margin: 0;
  color: var(--color-text-dim);
  font-size: var(--text-md);
  line-height: 1.5;
}
</style>
