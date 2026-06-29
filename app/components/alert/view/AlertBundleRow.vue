<script setup lang="ts">
import { computed } from 'vue'
import type { BundleModel } from '#shared/types/bundle'

/*
  One row in the view-mode bundle table.
  Pure presentation — takes a bundle + index, renders the row, emits
  `edit` when the pencil is clicked. All semantic state (status pip
  reason, format label) comes from composables so the visual stays in
  lockstep with whatever the rest of the app shows.
*/

const props = defineProps<{
  bundle: BundleModel
  index:  number
}>()

defineEmits<{ (e: 'edit', index: number): void }>()

const { formatLabel }   = useFormatLabel()
const { bundleStatus }  = useBundleStatus()

const status = computed(() => bundleStatus(props.bundle))
const displayName = computed(() => props.bundle.name || `Bundle ${props.index + 1}`)

// Destinations cell — first two names inline, overflow collapses into a
// "+N discussions" pill with the full list on hover (title attribute).
const firstTwo  = computed(() => props.bundle.discussion_list.slice(0, 2))
const overflow  = computed(() => props.bundle.discussion_list.slice(2))
const overflowTitle = computed(() => overflow.value.map(d => d.title).join('\n'))
</script>

<template>
  <div class="bundles-row">
    <div class="cell-index">{{ String(index + 1).padStart(2, '0') }}</div>

    <div class="cell-title-wrap">
      <span
        class="status-pip"
        :class="`pip-${status.kind}`"
        :title="status.label"
        aria-hidden="true"
      />
      <span class="cell-title" :title="displayName">{{ displayName }}</span>
    </div>

    <div class="cell-format">
      <span class="format-chip">{{ formatLabel(bundle.formating) }}</span>
    </div>

    <div class="cell-dest">
      <span
        v-if="bundle.discussion_list.length === 0"
        class="dest-empty"
        title="No destinations set"
      >No destinations</span>
      <template v-else>
        <span
          v-for="d in firstTwo"
          :key="d.id"
          class="dest-chip"
          :title="d.title"
        >{{ d.title }}</span>
        <span
          v-if="overflow.length > 0"
          class="dest-more"
          :title="overflowTitle"
        >+{{ overflow.length }} discussions</span>
      </template>
    </div>

    <button
      type="button"
      class="cell-edit"
      title="Edit bundle"
      @click="$emit('edit', index)"
    >
      <FontAwesomeIcon :icon="['fas', 'pencil']" />
    </button>
  </div>
</template>

<style scoped>
.bundles-row {
  display: grid;
  grid-template-columns: 40px 1.4fr 1.5fr 1.5fr 36px;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.bundles-row:hover {
  border-color: var(--color-border-default);
  box-shadow: var(--shadow-sm);
}
.cell-index {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-faint);
  letter-spacing: 0.5px;
}
.cell-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.status-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pip-ready     { background: var(--color-success); }
.pip-no-dest   { background: var(--color-warning); }
.pip-no-script { background: var(--color-warning); }
.cell-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.cell-format { min-width: 0; }
.format-chip {
  display: inline-block;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-dest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--text-sm);
}
.dest-chip {
  display: inline-block;
  padding: 1px var(--space-3);
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dest-more {
  display: inline-block;
  padding: 1px var(--space-3);
  background: transparent;
  border: 1px dashed var(--color-border-default);
  color: var(--color-text-dim);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: help;
  white-space: nowrap;
}
.dest-empty {
  color: var(--color-text-faint);
  font-style: italic;
}

.cell-edit {
  background: transparent;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color .15s, color .15s, border-color .15s;
}
.cell-edit:hover {
  background: var(--color-border-subtle);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}
</style>
