<script setup lang="ts">

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Source } from '#shared/types/source'

const props = withDefaults(defineProps<{
  modelValue: string
  locked?: boolean
}>(), {
  locked: false
})
const emit = defineEmits(['update:modelValue'])

const sources = Object.values(Source)
const searchQuery = ref('')
const isDropdownOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return q ? sources.filter(s => s.toLowerCase().includes(q)) : sources
})

const select = (s: string) => {
  emit('update:modelValue', (s===undefined ? '' : s))
  searchQuery.value = ''
  isDropdownOpen.value = false
}

const clear = async() => {
  isDropdownOpen.value = true
  await nextTick()
  emit('update:modelValue', '')
  
}

const onClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node))
    isDropdownOpen.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="selector">
    <div v-if="modelValue" class="selected-badge">
      <div class="selected-left">
        <span class="check">✔</span>
        <strong>{{ modelValue }}</strong>
      </div>
      <button v-if="!locked" type="button" class="btn-change" @click.stop="clear">{{ $t('inputSourceSelector.changeButton') }}</button>
      <span v-else class="locked-hint">{{ $t('inputSourceSelector.lockedHint') }}</span>
    </div>
    <div v-else class="search-wrap" ref="containerRef">
      <input
        v-model="searchQuery"
        @focus="isDropdownOpen = true"
        type="text"
        :placeholder="$t('inputSourceSelector.searchPlaceholder')"
        class="search-input"
      />
      <div v-if="isDropdownOpen" class="dropdown">
        <div v-for="s in filtered" :key="s" @mousedown.prevent="select(s)" class="dropdown-item">
          {{ s }}
        </div>
        <div v-if="filtered.length === 0" class="dropdown-empty">{{ $t('inputSourceSelector.noResults') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selector { width: 25%; position: relative; }

.selected-badge {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-md);
  padding: 9px var(--space-4);
  box-sizing: border-box;
}
.selected-left { display: flex; align-items: center; gap: var(--space-3); color: var(--color-accent-text); font-size: var(--text-base); }
.check { color: var(--color-success); font-size: var(--text-md); }

.btn-change {
  background: none; border: none;
  color: var(--color-accent);
  font-size: var(--text-md);
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.btn-change:hover { color: var(--color-accent-text); }
.locked-hint { color: var(--color-text-faint); font-size: var(--text-sm); }

.search-wrap { position: relative; width: 100%; }

.search-input {
  width: 100%; box-sizing: border-box;
  padding: 9px var(--space-4);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.search-input::placeholder { color: var(--color-border-default); }

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 16px rgba(0,0,0,0.4);
  max-height: 180px;
  overflow-y: auto;
  z-index: 50;
}
.dropdown-item {
  padding: 9px var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
}
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background: var(--color-border-subtle); color: var(--color-text-primary); }
.dropdown-empty { padding: var(--space-3) var(--space-4); color: var(--color-text-faint); font-size: var(--text-base); font-style: italic; }
</style>
