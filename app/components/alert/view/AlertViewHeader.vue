<script setup lang="ts">
import { computed } from "vue";
import type { AlertStatus } from "#shared/types/alert";

/*
  View-mode page header. Two rows in one block:
    1. Status Toggle (if alert is complete) + Title (truncated, single line)
       + Edit button + overflow menu (AlertActionsMenu) on the right.
    2. Description — italic + faint, truncated to 100 chars by parent.

  Pure presentation. Every side-effectful action is a forwarded event:
    - update:status  → the toggle moved.
    - edit           → the Edit button was clicked.
    - duplicate / delete / manage-access / move-to-project → surfaced by
      AlertActionsMenu, forwarded here so the smart container (AlertView)
      is the one place that knows what to do.
*/

const props = defineProps<{
  title: string;
  description?: string;
  inputTitle: string;
  status: AlertStatus;
  isExisting: boolean;
  canActivate: boolean;
  /** Enables the "Test now" item in the overflow menu (polling alerts). */
  canTest?: boolean;
}>();

defineEmits<{
  (e: "edit"): void;
  (e: "test"): void;
  (e: "duplicate"): void;
  (e: "manage-access"): void;
  (e: "move-to-project"): void;
  (e: "delete"): void;
  (e: "update:status"): void;
}>();

const statusModel = computed({
  get: () => props.status,
  set: () => {},
});
</script>

<template>
  <div class="panel-head view-head">
    <div class="head-main">
      <h2 class="view-title">
        <span class="title-text">{{ title || $t("common.untitled") }}</span>
        <span class="meta-tag">{{ inputTitle }}</span>
      </h2>
      <div class="head-actions">
        <StatusToggle
          v-if="isExisting"
          v-model:status="statusModel"
          :can-activate="canActivate"
          @update:state="$emit('update:status')"
        />
        <button
          type="button"
          class="btn btn-primary btn-sm"
          @click="$emit('edit')"
        >
          {{ $t("editor.header.editAlert") }}
        </button>

        <AlertActionsMenu
          :can-test="canTest"
          @test="$emit('test')"
          @duplicate="$emit('duplicate')"
          @manage-access="$emit('manage-access')"
          @move-to-project="$emit('move-to-project')"
          @delete="$emit('delete')"
        />
      </div>
    </div>

    <p v-if="description" class="view-subtitle">{{ description }}</p>
  </div>
</template>

<style scoped>
.view-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
}
.head-main {
  display: flex;
  flex-direction: row;
  gap: var(--space-4);
  padding-left: var(--space-2);
  min-width: 0;
}
.head-actions {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-3) 0 0;
  margin-left: auto;
  flex-shrink: 0;
  gap: var(--space-4);
}

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}
.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-subtitle {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 400;
  font-style: italic;
  color: var(--color-text-dim);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: var(--space-1);
}

.meta-tag {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  margin-top: 3px;
}
</style>
