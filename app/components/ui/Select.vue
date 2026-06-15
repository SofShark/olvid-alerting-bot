<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type Option = { value: string; label: string }

const props = withDefaults(defineProps<{
  modelValue: string
  options: Option[]
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: 'Select…',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const current = computed(() =>
  props.options.find(o => o.value === props.modelValue),
)

const displayLabel = computed(() => current.value?.label ?? props.placeholder)

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function select(opt: Option) {
  emit('update:modelValue', opt.value)
  isOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="containerRef" class="select-wrap">
    <button
      type="button"
      class="select-trigger"
      :class="{ open: isOpen, disabled }"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="select-label">{{ displayLabel }}</span>
      <span class="select-chevron" :class="{ open: isOpen }">▾</span>
    </button>

    <div v-if="isOpen && !disabled" class="select-dropdown">
      <div
        v-for="opt in options"
        :key="opt.value"
        class="select-item"
        :class="{ selected: opt.value === modelValue }"
        @mousedown.prevent="select(opt)"
      >
        {{ opt.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-wrap { position: relative; width: 100%; }

/* Trigger looks like a search-input in InputSourceSelector — same tokens, same
 * focus ring. The only addition is a chevron icon on the right that flips
 * when the dropdown is open. */
.select-trigger {
  width: 100%;
  box-sizing: border-box;
  padding: 9px var(--space-4);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  transition: border-color .15s, box-shadow .15s;
}
.select-trigger:focus,
.select-trigger.open {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.select-trigger.disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: var(--color-bg-card);
}

.select-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-chevron {
  color: var(--color-text-dim);
  font-size: 12px;
  transition: transform .15s;
}
.select-chevron.open { transform: rotate(180deg); }

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 16px rgba(0,0,0,0.4);
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
}
.select-item {
  padding: 9px var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
}
.select-item:last-child { border-bottom: none; }
.select-item:hover {
  background: var(--color-border-subtle);
  color: var(--color-text-primary);
}
.select-item.selected {
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
}
</style>
