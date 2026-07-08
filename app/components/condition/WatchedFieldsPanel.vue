<script setup lang="ts">
/*
  Watched-fields section of the polling ConditionEditor:

    - Header    → label + hint + Type-path / Pick-from-source buttons.
    - Chips row → one chip per configured path (with a × remove) plus
                  the inline "typing a new path" chip when active.
    - Empty     → italic placeholder when there are no chips yet.

  Owns: local `useWatchedPathInput` state for the inline typing UX.
  Delegates to parent for the actual chip list mutations.
*/

const props = defineProps<{
  paths: string[];
  effectiveCount: number;
  /** Parsed source snapshot — used to validate typed paths. Optional. */
  parsed: unknown;
}>();

const emit = defineEmits<{
  (e: "add-path", path: string): void;
  (e: "remove-path", path: string): void;
  (e: "open-picker"): void;
}>();

const {
  isAdding,
  newPath,
  addError,
  inputRef,
  startAdding,
  commitAdd,
  cancelAdd,
} = useWatchedPathInput(
  () => props.paths,
  () => props.parsed,
  (v) => emit("add-path", v),
);
</script>

<template>
  <div class="rule-row">
    <!-- Header row — label + hint on the left, action buttons on the
         right. Buttons stay in a fixed slot regardless of chip count. -->
    <div class="watched-head">
      <div class="watched-meta">
        <span class="rule-label">
          {{ $t("conditionEditor.watchedFields.label") }}
          <span class="rule-count">({{ effectiveCount }})</span>
        </span>
        <!-- Hint has two code-styled snippets — kept as one translatable
             string via i18n-t children. -->
        <p class="rule-hint">
          <i18n-t keypath="conditionEditor.watchedFields.hint" tag="span">
            <template #dotdot
              ><code>{{
                $t("conditionEditor.watchedFields.hintCode")
              }}</code></template
            >
            <template #example
              ><code>{{
                $t("conditionEditor.watchedFields.hintExample")
              }}</code></template
            >
          </i18n-t>
        </p>
      </div>

      <div class="watched-actions">
        <button
          type="button"
          class="btn btn-primary"
          small
          @click="startAdding"
        >
          <span class="add-icon">✎</span>
          {{ $t("conditionEditor.watchedFields.typePath") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          small
          @click="emit('open-picker')"
        >
          <span class="add-icon">⊞</span>
          {{ $t("conditionEditor.watchedFields.pickFromSource") }}
        </button>
      </div>
    </div>

    <p v-if="addError" class="add-error">⚠ {{ addError }}</p>

    <!-- Chips row hosts the watched paths AND the inline typing input
         when active — the input behaves like a "chip in progress". -->
    <div v-if="paths.length > 0 || isAdding" class="chips">
      <span v-for="p in paths" :key="p" class="chip">
        <span class="chip-path">{{ p }}</span>
        <button type="button" class="chip-x" @click="emit('remove-path', p)">
          ×
        </button>
      </span>

      <span
        v-if="isAdding"
        class="chip-input-wrap"
        :class="{ 'has-error': addError }"
      >
        <input
          ref="inputRef"
          v-model="newPath"
          type="text"
          class="chip-input"
          :placeholder="$t('conditionEditor.watchedFields.inputPlaceholder')"
          @keydown.enter.prevent="commitAdd"
          @keydown.escape="cancelAdd"
        >
        <button
          type="button"
          class="chip-input-done"
          :title="$t('conditionEditor.watchedFields.inputDone')"
          @click="commitAdd"
        >
          ✓
        </button>
        <button
          type="button"
          class="chip-input-cancel"
          :title="$t('conditionEditor.watchedFields.inputCancel')"
          @click="cancelAdd"
        >
          ✕
        </button>
      </span>
    </div>
    <p v-else class="chips-empty">
      {{ $t("conditionEditor.watchedFields.emptyChips") }}
    </p>
  </div>
</template>

<style scoped>
.rule-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ── Header row ──────────────────────────────────────────────────── */
.watched-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.watched-meta {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.watched-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  flex-shrink: 0;
}
.add-icon {
  font-size: var(--text-base);
  line-height: 1;
}

.rule-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.rule-count {
  color: var(--color-text-faint);
  font-weight: 500;
  margin-left: var(--space-1);
}

.rule-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-md);
  line-height: 1.5;
}
.rule-hint code {
  color: var(--color-accent-text);
  background: var(--color-border-subtle);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.add-error {
  margin: 0;
  color: var(--color-danger-text);
  font-size: var(--text-sm);
}

/* ── Chips + inline input ────────────────────────────────────────── */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.chip {
  padding: 3px var(--space-1) 3px var(--space-3);
}
.chip-path {
  white-space: nowrap;
}
.chip-x {
  background: transparent;
  border: none;
  color: var(--color-accent-text);
  font-size: var(--text-lg);
  line-height: 1;
  padding: 0 var(--space-1);
  cursor: pointer;
}
.chip-x:hover {
  color: var(--color-text-on-accent);
}

.chips-empty {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-md);
  font-style: italic;
}

.chip-input-wrap {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-input);
}
.chip-input-wrap.has-error {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
}
.chip-input {
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 4px var(--space-3);
  outline: none;
  min-width: 180px;
}
.chip-input-done,
.chip-input-cancel {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0 var(--space-2);
  font-size: var(--text-md);
  transition: background-color 0.12s, color 0.12s;
}
.chip-input-done:hover {
  background: var(--color-accent-soft);
  color: var(--color-text-primary);
}
.chip-input-cancel:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
}
</style>
