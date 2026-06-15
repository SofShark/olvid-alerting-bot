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
  <div class="selector">

    <!-- Selected chips -->
    <div v-if="modelValue.length > 0" class="chips">
      <div v-for="d in modelValue" :key="d.id" class="chip">
        <span class="chip-title">{{ d.title }}</span>
        <!--span class="chip-id">#{{ d.id }}</span-->
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
          <!--span class="item-id">#{{ d.id }}</span-->
        </div>
        <div v-if="filtered.length === 0" class="dropdown-empty">
          {{ available.length === 0 ? 'No discussions found in daemon' : 'All discussions already added' }}
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.selector { display: flex; flex-direction: column; gap: var(--space-3); width: 100%; }

/* Chip layout overrides the global chip's tight padding — discussion chips
 * carry a wider title + a × button so a touch more breathing room helps. */
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip {
  display: flex; align-items: center;
  gap: var(--space-2);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-md);
}
.chip-title { color: var(--color-accent-text); font-weight: 500; }
.chip-id    { color: var(--color-text-faint); font-family: var(--font-mono); font-size: var(--text-sm); }
.chip-remove {
  background: none; border: none;
  color: var(--color-danger);
  cursor: pointer;
  padding: 0;
  font-size: var(--text-sm);
  line-height: 1;
  transition: color .15s;
}
.chip-remove:hover { color: var(--color-danger-text); }

/* ── Search input ─────────────────────────────────────────────────── */
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
.search-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Dropdown ─────────────────────────────────────────────────────── */
.dropdown {
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
.dropdown-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px var(--space-4);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
}
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background: var(--color-border-subtle); }

.item-title { color: var(--color-text-secondary); font-size: var(--text-base); }
.item-id    { color: var(--color-text-faint); font-family: var(--font-mono); font-size: var(--text-sm); }
.dropdown-empty {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-faint);
  font-size: var(--text-base);
  font-style: italic;
}
</style>
