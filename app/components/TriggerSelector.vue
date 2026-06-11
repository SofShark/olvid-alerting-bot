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
    <!-- Single supported trigger → locked badge -->
    <div v-if="isLocked" class="trigger-locked">
      <span class="lock">🔒</span>
      <span class="trigger-name">{{ triggers[0] }}</span>
      <span class="locked-hint">only option for this source</span>
    </div>

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
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0f2744;
  border: 1px solid #1e40af;
  border-radius: 5px;
  padding: 9px 12px;
}
.lock { font-size: 14px; }
.trigger-name { color: #93c5fd; font-weight: 600; font-size: 13px; }
.locked-hint { color: #475569; font-size: 11px; margin-left: auto; }

.trigger-options { display: flex; gap: 8px; flex-wrap: wrap; }
.trigger-pill {
  background: #090d16;
  color: #94a3b8;
  border: 1px solid #1e293b;
  border-radius: 5px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.trigger-pill:hover { border-color: #334155; color: #cbd5e1; }
.trigger-pill.active {
  background: #0f2744;
  border-color: #1e40af;
  color: #93c5fd;
}

.trigger-empty {
  color: #475569;
  font-size: 12px;
  font-style: italic;
  padding: 6px 0;
}
</style>
