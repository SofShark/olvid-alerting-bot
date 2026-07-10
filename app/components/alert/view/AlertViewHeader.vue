<script setup lang="ts">
import type { AlertStatus } from "#shared/types/alert";
import { ref, computed, onMounted, onBeforeUnmount } from "vue";




/*
  View-mode page header. Two rows in one block:
    1. Status Toggle (if alert is complete) + Title (truncated, single line) + Edit/Delete actions on the right.
    2. Description — italic + faint, truncated to 100 chars by parent.

  Pure presentation: `update:status` fires when  the Toggle moves; the parent runs the actual setStatus call.
*/

const props = defineProps<{
  title: string;
  description?: string;
  inputTitle: string;
  status: AlertStatus;
  isExisting: boolean;
  canActivate: boolean;
}>();

const options = ref(false)
const optionsRef = ref<HTMLElement | null>(null);

function toggleOptions() {
  options.value = !options.value;
}

function closeOptions() {
  options.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (
    optionsRef.value &&
    !optionsRef.value.contains(e.target as Node)
  ) {
    options.value = false;
  }
}

onMounted(() =>
  document.addEventListener("click", onClickOutside),
);

onBeforeUnmount(() =>
  document.removeEventListener("click", onClickOutside),
);




defineEmits<{
  (e: "edit"): void;
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
        

        <div ref="optionsRef" class="options-wrap">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="{ open: options }"
            @click="toggleOptions"
          >
            <FontAwesomeIcon
              :icon="['fas', 'ellipsis-vertical']"
              class="optionMenuIcon"
            />
          </button>

          <div
            v-if="options"
            class="options-dropdown"
          >
            <button
              class="options-item"
              @click="closeOptions"
            >
              Duplicate
              
              <FontAwesomeIcon :icon="['fas', 'copy']" />
              
            </button>

            <button
              class="options-item"
              @click="closeOptions"
            > 
              Manage Access
              <FontAwesomeIcon :icon="['fas', 'user-gear']" />
            </button>

            <button
              class="options-item"
              @click="closeOptions"
            >
              Move to project
              <FontAwesomeIcon :icon="['fas', 'left-right']" />
              
            </button>

            <div class="options-separator" />

            <button
              class="options-item danger"
              @click="
                closeOptions();
                $emit('delete');
              "
            >
               {{ $t("button.delete") }}
              <FontAwesomeIcon :icon="['fas', 'trash-can']" />
            </button>
          </div>
        </div>
    
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
  gap: var(--space-);
  padding: var(--space-4) var(--space-6);
}
.head-main {
  display: flex;
  flex-direction: row; /*was column */
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
  color: var(--color-text-faint);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: var(--space-1);
}

.head-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: var(--text-sm);
  margin-top: var(--space-1);
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
.meta-dim {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/*TODO : Reuse */

.optionMenuIcon {
  font-size: 14px;
}

.options-wrap {
  position: relative;
}

.options-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;

  min-width: 180px;

  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);

  padding: var(--space-1);

  display: flex;
  flex-direction: column;

  z-index: 200;
}

.options-item {
  display: flex;
  align-items: center;
  justify-content: space-between;

  background: transparent;
  border: none;
  border-radius: var(--radius-sm);

  width: 100%;
  padding: 8px var(--space-3);

  text-align: left;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 500;

  color: var(--color-text-secondary);
  cursor: pointer;

  transition:
    background-color .15s,
    color .15s;
}

.options-item:hover {
  background: var(--color-bg-card-soft);
  color: var(--color-text-primary);
}

.options-item.danger {
  color: var(--color-danger);
}

.options-item.danger:hover {
  background: var(--color-danger-soft);
}

.options-separator {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--color-border-subtle);
}
</style>
