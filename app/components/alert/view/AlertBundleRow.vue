<script setup lang="ts">
import { computed } from "vue";
import type { BundleModel } from "#shared/types/bundle";

/*
  One row in the view-mode bundle table.

  Design notes:
    - No index column. Bundle.name (or "Untitled") is the identity; a
      monospace "01" tag is noise.
    - No success indicator. Status pip is shown ONLY when something is
      wrong (no destinations / custom format without script). "Ready" is
      the silent default — admin tables don't celebrate the happy path.
    - Format and destination count read as plain dim text, not chips.
      Chips were competing visually with the section eyebrow and the
      alert's main title.
*/

const props = defineProps<{
  bundle: BundleModel;
  index: number;
}>();

defineEmits<{ (e: "edit", index: number): void }>();

const { formatLabel } = useFormatLabel();
const { bundleStatus } = useBundleStatus();

const status = computed(() => bundleStatus(props.bundle));
const hasWarning = computed(() => status.value.kind !== "ready");
const displayName = computed(() => props.bundle.name || "Untitled bundle");

const destCount = computed(() => props.bundle.discussion_list.length);
const destSummary = computed(() => {
  if (destCount.value === 0) return "No destinations";
  return `${destCount.value} destination${destCount.value === 1 ? "" : "s"}`;
});
</script>

<template>
  <div class="bundle-row" :class="{ 'has-warning': hasWarning }">
    <div class="row-main">
      <span class="row-title" :title="displayName">{{ displayName }}</span>
      <span class="row-meta">
        <span class="meta-format">{{ formatLabel(bundle.formating) }}</span>
        <span class="meta-sep" aria-hidden="true">·</span>
        <span
          class="meta-dest"
          :class="{ 'meta-warn': destCount === 0 }"
        >{{ destSummary }}</span>
        <template v-if="hasWarning && destCount > 0">
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-warn">{{ status.label }}</span>
        </template>
      </span>
    </div>

    <button
      type="button"
      class="row-edit"
      title="Edit bundle"
      @click="$emit('edit', index)"
    >
      <FontAwesomeIcon :icon="['fas', 'pencil']" />
    </button>
  </div>
</template>

<style scoped>
.bundle-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  transition: background-color .15s, border-color .15s;
}
.bundle-row:hover {
  background: var(--color-bg-card-soft);
  border-color: var(--color-border-default);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.row-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.row-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-dim);
  min-width: 0;
}
.meta-format { color: var(--color-text-secondary); }
.meta-dest   { font-variant-numeric: tabular-nums; }
.meta-sep    { color: var(--color-text-faint); }
.meta-warn   { color: var(--color-warning-text); font-weight: 500; }

.row-edit {
  background: transparent;
  border: none;
  color: var(--color-text-faint);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color .15s, color .15s;
}
.row-edit:hover {
  background: var(--color-border-subtle);
  color: var(--color-text-primary);
}
</style>
