<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

/*
  Overflow menu (⋮) for view-mode alert actions that don't warrant their
  own top-level button: duplicate, manage access, move to project, delete.
  Lives as a sibling of the Edit button inside AlertViewHeader — the
  header composes it, but the menu owns its own dropdown state,
  click-outside handling, and item wiring.

  Emits one event per item. Delete is styled as a destructive action
  (own colour, plus a separator above it). Manage/Move are stubbed —
  they emit their event so the parent can wire them when the features
  arrive; they render disabled by default via `unavailable` items.

  This file replaces the inline dropdown that used to live in
  AlertViewHeader.vue and mixed presentation concerns with menu logic.
*/

withDefaults(
  defineProps<{
    /** Show the "Test now" item. Only polling alerts have a pipeline to
     *  test — the parent decides based on `isPolling`. */
    canTest?: boolean;
  }>(),
  { canTest: false },
);

defineEmits<{
  (e: "test"): void;
  (e: "duplicate"): void;
  (e: "manage-access"): void;
  (e: "move-to-project"): void;
  (e: "delete"): void;
}>();

const { t } = useI18n();

const open = ref(false);
const wrapRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}
function close() {
  open.value = false;
}

// Click-outside — same pattern the header used, kept here now that
// the menu owns its state.
function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener("click", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>

<template>
  <div ref="wrapRef" class="options-wrap">
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      :class="{ open }"
      :title="t('alertActions.moreActions')"
      :aria-label="t('alertActions.moreActions')"
      @click="toggle"
    >
      <FontAwesomeIcon
        :icon="['fas', 'ellipsis-vertical']"
        class="options-icon"
      />
    </button>

    <div v-if="open" class="options-dropdown" role="menu">
      <button
        v-if="canTest"
        type="button"
        class="options-item"
        role="menuitem"
        @click="
          close();
          $emit('test');
        "
      >
        {{ t("alertActions.testNow") }}
        <FontAwesomeIcon :icon="['fas', 'play']" />
      </button>

      <button
        type="button"
        class="options-item"
        role="menuitem"
        @click="
          close();
          $emit('duplicate');
        "
      >
        {{ t("alertActions.duplicate") }}
        <FontAwesomeIcon :icon="['fas', 'copy']" />
      </button>

      <!-- Placeholder actions for features not yet wired. They emit so a
           future parent can hook them up without touching this file. -->
      <button
        type="button"
        class="options-item"
        role="menuitem"
        @click="
          close();
          $emit('manage-access');
        "
      >
        {{ t("alertActions.manageAccess") }}
        <FontAwesomeIcon :icon="['fas', 'user-gear']" />
      </button>

      <button
        type="button"
        class="options-item"
        role="menuitem"
        @click="
          close();
          $emit('move-to-project');
        "
      >
        {{ t("alertActions.moveToProject") }}
        <FontAwesomeIcon :icon="['fas', 'left-right']" />
      </button>

      <div class="options-separator" />

      <button
        type="button"
        class="options-item danger"
        role="menuitem"
        @click="
          close();
          $emit('delete');
        "
      >
        {{ t("button.delete") }}
        <FontAwesomeIcon :icon="['fas', 'trash-can']" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.options-icon {
  font-size: 14px;
}
.options-wrap {
  position: relative;
}

.options-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 200px;
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
  gap: var(--space-3);
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
    background-color 0.15s,
    color 0.15s;
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
