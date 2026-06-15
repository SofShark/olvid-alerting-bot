<script setup lang="ts">
import {
  StepperRoot,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from 'reka-ui'

defineProps<{
  modelValue: number
  steps: { title: string; description?: string; disabled?: boolean }[]
}>()

defineEmits<{ (e: 'update:modelValue', v: number): void }>()
</script>

<template>
  <StepperRoot
    :model-value="modelValue"
    class="stepper"
    @update:model-value="$emit('update:modelValue', $event ?? 1)"
  >
    <StepperItem
      v-for="(s, i) in steps"
      :key="i"
      :step="i + 1"
      :disabled="!!s.disabled"
      class="stepper-item"
    >
      <StepperTrigger class="stepper-trigger">
        <StepperIndicator class="stepper-indicator">
          <span class="indicator-num">{{ i + 1 }}</span>
          <svg class="indicator-check" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </StepperIndicator>
        <div class="stepper-text">
          <StepperTitle class="stepper-title">{{ s.title }}</StepperTitle>
          <span v-if="s.description" class="stepper-desc">{{ s.description }}</span>
        </div>
      </StepperTrigger>
      <StepperSeparator
        v-if="i < steps.length - 1"
        class="stepper-separator"
      />
    </StepperItem>
  </StepperRoot>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.stepper-item {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.stepper-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 4px 12px 4px 4px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  transition: background-color 0.18s, border-color 0.18s;
}
.stepper-trigger:hover:not([data-disabled]) { background: rgba(59, 130, 246, 0.06); }
.stepper-trigger:disabled,
.stepper-trigger[data-disabled] { cursor: not-allowed; opacity: 0.5; }

.stepper-indicator {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #0f172a;
  border: 1.5px solid #334155;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.indicator-check { display: none; width: 12px; height: 12px; color: #fff; }

/* Active state — blue ring + bright label */
.stepper-item[data-state='active'] .stepper-indicator {
  background: linear-gradient(135deg, #3b82f6, #1e40af);
  border-color: #60a5fa;
  color: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), 0 2px 6px rgba(59, 130, 246, 0.35);
}
.stepper-item[data-state='active'] .stepper-trigger {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.35);
}

/* Completed state — filled blue + checkmark */
.stepper-item[data-state='completed'] .stepper-indicator {
  background: #1e40af;
  border-color: #1e40af;
  color: #fff;
}
.stepper-item[data-state='completed'] .indicator-num { display: none; }
.stepper-item[data-state='completed'] .indicator-check { display: inline-block; }

.stepper-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  gap: 1px;
}
.stepper-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin: 0;
}
.stepper-desc {
  font-size: 10px;
  color: #475569;
  letter-spacing: 0.1px;
}

.stepper-item[data-state='active'] .stepper-title { color: #f8fafc; }
.stepper-item[data-state='active'] .stepper-desc  { color: #93c5fd; }
.stepper-item[data-state='completed'] .stepper-title { color: #cbd5e1; }
.stepper-item[data-state='completed'] .stepper-desc  { color: #64748b; }

.stepper-separator {
  flex: 1 1 auto;
  height: 2px;
  border-radius: 1px;
  background: #1e293b;
  margin: 0 4px;
  min-width: 18px;
  transition: background 0.2s;
}
.stepper-separator[data-state='completed'] {
  background: linear-gradient(90deg, #1e40af, #3b82f6);
}
</style>
