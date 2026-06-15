<script setup lang="ts">
import { computed, watch } from 'vue'
import { Source, Trigger, sourceTriggers } from '#shared/constants'

const props = withDefaults(defineProps<{
  modelValue?: string
  source?: string
}>(), {
  modelValue: '',
  source: ''
})

const emit = defineEmits(['update:modelValue'])

// Triggers supported by the currently selected input source.
const triggers = computed<Trigger[]>(() => {
  if (!props.source) return []
  return sourceTriggers[props.source as Source] ?? []
})

const isLocked = computed(() => triggers.value.length === 1)

// When there's exactly one possible trigger, set it automatically.
watch(triggers, (list) => {
  if (list.length === 1 && props.modelValue !== list[0]) {
    emit('update:modelValue', list[0])
  } else if (list.length === 0 && props.modelValue) {
    emit('update:modelValue', '')
  }
}, { immediate: true })

const select = (t: string) => emit('update:modelValue', t)
</script>

<template>
  <div class="trigger-selector">
    <!-- Single supported trigger → small informative text -->
    <p v-if="isLocked" class="trigger-locked">
      <span class="trigger-name">{{ triggers[0] }}</span>
      <span class="locked-hint">— how this source communicates with the alert system</span>
    </p>

    <!-- Multiple triggers → selectable pills -->
    <div v-else-if="triggers.length > 1" class="trigger-options">
      <button
        v-for="t in triggers"
        :key="t"
        type="button"
        class="trigger-pill"
        :class="{ active: modelValue === t }"
        @click="select(t)"
      >
        {{ t }}
      </button>
    </div>

    <!-- No source / no triggers -->
    <div v-else class="trigger-empty">Select an input source first.</div>
  </div>
</template>

<style scoped>
.trigger-selector { width: 100%; }

.trigger-locked {
  margin: 0;
  padding: 2px 0;
  font-size: var(--text-md);
  line-height: 1.4;
  color: var(--color-text-muted);
}
.trigger-name { color: var(--color-accent-text); font-weight: 600; }
.locked-hint  { color: var(--color-text-dim); font-size: var(--text-sm); margin-left: var(--space-1); }

.trigger-options { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.trigger-pill {
  background: var(--color-bg-input);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
}
.trigger-pill:hover { border-color: var(--color-border-default); color: var(--color-text-secondary); }
.trigger-pill.active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-accent-text);
}

.trigger-empty {
  color: var(--color-text-faint);
  font-size: var(--text-md);
  font-style: italic;
  padding: var(--space-2) 0;
}
</style>
