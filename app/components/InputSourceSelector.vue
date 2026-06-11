<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Source } from '#shared/constants'

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

const clear = () => emit('update:modelValue', '')

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
      <button v-if="!locked" type="button" class="btn-change" @click="clear">Change</button>
      <span v-else class="locked-hint">🔒 Can't be changed, bundles already depend on this source</span>
    </div>
    <div v-else class="search-wrap" ref="containerRef">
      <input
        v-model="searchQuery"
        @focus="isDropdownOpen = true"
        type="text"
        placeholder="Search source (GitHub, Grafana, Sentry...)"
        class="search-input"
      />
      <div v-if="isDropdownOpen" class="dropdown">
        <div v-for="s in filtered" :key="s" @mousedown.prevent="select(s)" class="dropdown-item">
          {{ s }}
        </div>
        <div v-if="filtered.length === 0" class="dropdown-empty">No results</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selector { width: 100%; position: relative; }
.selected-badge { display: flex; justify-content: space-between; align-items: center; background: #0f2744; border: 1px solid #1e40af; border-radius: 5px; padding: 9px 12px; box-sizing: border-box; }
.selected-left { display: flex; align-items: center; gap: 8px; color: #93c5fd; font-size: 13px; }
.check { color: #22c55e; font-size: 12px; }
.btn-change { background: none; border: none; color: #3b82f6; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 0; }
.btn-change:hover { color: #93c5fd; }
.locked-hint { color: #475569; font-size: 11px; }
.search-wrap { position: relative; width: 100%; }
.search-input { width: 100%; box-sizing: border-box; padding: 9px 12px; background: #090d16; color: #f1f5f9; border: 1px solid #1e293b; border-radius: 5px; font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s; }
.search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
.search-input::placeholder { color: #334155; }
.dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0f172a; border: 1px solid #1e293b; border-radius: 5px; box-shadow: 0 8px 16px rgba(0,0,0,0.4); max-height: 180px; overflow-y: auto; z-index: 50; }
.dropdown-item { padding: 9px 12px; font-size: 13px; color: #cbd5e1; cursor: pointer; border-bottom: 1px solid #1e293b; }
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background: #1e293b; color: #f1f5f9; }
.dropdown-empty { padding: 10px 12px; color: #475569; font-size: 13px; font-style: italic; }
</style>
