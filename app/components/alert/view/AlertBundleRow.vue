<script setup lang="ts">
import { computed } from "vue";
import type { BundleModel } from "#shared/types/bundle";
import {
  olvidIdsOf,
  mailAddressesOf,
  bundleKind,
} from "~/composables/useAlertForm";
import { BundleOutputType } from "#shared/types/bundleOutput";

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
const t = useI18n().t;

const props = withDefaults(
  defineProps<{
    bundle: BundleModel;
    index: number;
    /** Wizard rows can be removed; view-mode rows can't. Off by default
     *  so existing view-mode usage is untouched. */
    removable?: boolean;
  }>(),
  { removable: false },
);

defineEmits<{
  (e: "edit", index: number): void;
  (e: "remove", index: number): void;
}>();

const { formatLabel } = useFormatLabel();
const { bundleStatus } = useBundleStatus();

const status = computed(() => bundleStatus(props.bundle));
const hasWarning = computed(() => status.value.kind !== "ready");
const displayName = computed(() => props.bundle.name || "Untitled bundle");

// Row summary reads only the active kind's items — bundles are now
// homogeneous (one channel per bundle). `bundleKind()` picks the right
// list; the count and the "first two names" follow.
const { availableDiscussions } = useAlerts();

const kind = computed(() => bundleKind(props.bundle.outputs));

const destNames = computed<string[]>(() => {
  if (kind.value === BundleOutputType.Olvid) {
    const titleFor = (id: string) =>
      availableDiscussions.value?.find((d) => d.id === id)?.title ?? `#${id}`;
    return olvidIdsOf(props.bundle.outputs).map(titleFor);
  }
  if (kind.value === BundleOutputType.Mail) {
    return mailAddressesOf(props.bundle.outputs);
  }
  return [];
});
const destCount = computed(() => destNames.value.length);

const destSummary = computed(() => {
  const count = destCount.value;
  if (count === 0) return "No destinations";
  const firstTwoNames = destNames.value.slice(0, 2).join(", ");
  if (count <= 2) return firstTwoNames;
  const remaining = count - 2;
  if (remaining === 1) {
    return t(`bundleRow.destSummary.PlusOne`, { firstTwoNames });
  }
  return t(`bundleRow.destSummary.Plural`, { firstTwoNames, remaining });
});
</script>

<template>
  <div class="bundle-row" :class="{ 'has-warning': hasWarning }">
    <div class="row-main">
      <span class="row-title" :title="displayName">{{ displayName }}</span>
      <span class="row-meta">
        <span class="meta-format">{{ formatLabel(bundle.formating) }}</span>
        <span class="meta-sep" aria-hidden="true">·</span>
        <span class="meta-dest" :class="{ 'meta-warn': destCount === 0 }">{{
          destSummary
        }}</span>
        <template v-if="hasWarning && destCount > 0">
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-warn">{{ status.label }}</span>
        </template>
      </span>
    </div>

    <div class="row-actions">
      <button
        type="button"
        class="row-edit"
        title="Edit bundle"
        @click="$emit('edit', index)"
      >
        <FontAwesomeIcon :icon="['fas', 'pencil']" />
      </button>
      <button
        v-if="removable"
        type="button"
        class="row-edit row-remove"
        title="Remove bundle"
        @click="$emit('remove', index)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.bundle-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  transition:
    background-color 0.15s,
    border-color 0.15s;
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
.meta-format {
  color: var(--color-text-secondary);
}
.meta-dest {
  font-variant-numeric: tabular-nums;
}
.meta-sep {
  color: var(--color-text-faint);
}
.meta-warn {
  color: var(--color-warning-text);
  font-weight: 500;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
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
  transition:
    background-color 0.15s,
    color 0.15s;
}
.row-edit:hover {
  background: var(--color-border-subtle);
  color: var(--color-text-primary);
}
.row-remove:hover {
  background: color-mix(in srgb, var(--color-danger, #ef4444) 12%, transparent);
  color: var(--color-danger-text, #b91c1c);
}
</style>
