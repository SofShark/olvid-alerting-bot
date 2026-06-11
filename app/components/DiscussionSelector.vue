<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { DiscussionModel } from '#shared/constants'

const props = withDefaults(defineProps<{
  modelValue: DiscussionModel[]
  available?: DiscussionModel[]
  isLoading?: boolean
}>(), {
  available: () => [],
  isLoading: false
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const isDropdownOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const selectedIds = new Set(props.modelValue.map(d => d.id))
  const q = searchQuery.value.toLowerCase()
  return props.available
    .filter(d => !selectedIds.has(d.id))
    .filter(d => !q || d.title.toLowerCase().includes(q))
})

const add = (d: DiscussionModel) => {
  emit('update:modelValue', [...props.modelValue, d])
  searchQuery.value = ''
  // dropdown stays open so the user can keep selecting
}

const remove = (id: string) => {
  emit('update:modelValue', props.modelValue.filter(d => d.id !== id))
}

const onClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node))
    isDropdownOpen.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="discussion-selector">

    <!-- Selected chips -->
    <div v-if="modelValue.length > 0" class="chips">
      <div v-for="d in modelValue" :key="d.id" class="chip">
        <span class="chip-title">{{ d.title }}</span>
        <span class="chip-id">#{{ d.id }}</span>
        <button type="button" class="chip-remove" @click="remove(d.id)">✕</button>
      </div>
    </div>

    <!-- Search / add -->
    <div class="search-wrap" ref="containerRef">
      <input
        v-model="searchQuery"
        @focus="isDropdownOpen = true"
        type="text"
        :placeholder="isLoading ? 'Loading...' : available.length === 0 ? 'No discussions available' : 'Add a discussion...'"
        :disabled="isLoading"
        class="search-input"
      />
      <div v-if="isDropdownOpen" class="dropdown">
        <div
          v-for="d in filtered"
          :key="d.id.toString()"
          @mousedown.prevent="add(d)"
          class="dropdown-item"
        >
          <span class="item-title">{{ d.title }}</span>
          <span class="item-id">#{{ d.id }}</span>
        </div>
        <div v-if="filtered.length === 0" class="dropdown-empty">
          {{ available.length === 0 ? 'No discussions found in daemon' : 'All discussions already added' }}
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.discussion-selector { display: flex; flex-direction: column; gap: 8px; width: 100%; }

/* ── Chips ── */
.chips { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #0f2744;
  border: 1px solid #1e40af;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
}
.chip-title { color: #93c5fd; font-weight: 500; }
.chip-id { color: #475569; font-family: monospace; font-size: 11px; }
.chip-remove {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  transition: color 0.15s;
}
.chip-remove:hover { color: #fca5a5; }

/* ── Search ── */
.search-wrap { position: relative; width: 100%; }

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid #1e293b;
  border-radius: 5px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
.search-input::placeholder { color: #334155; }
.search-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Dropdown ── */
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 5px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.4);
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
}
.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  cursor: pointer;
  border-bottom: 1px solid #1e293b;
}
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background: #1e293b; }

.item-title { color: #cbd5e1; font-size: 13px; }
.item-id { color: #475569; font-family: monospace; font-size: 11px; }
.dropdown-empty { padding: 10px 12px; color: #475569; font-size: 13px; font-style: italic; }
</style>
