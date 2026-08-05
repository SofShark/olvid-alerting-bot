<script setup lang="ts">
import { ref } from "vue";

/*
  Handlebars script editor. Owns the textarea + the watched-paths
  shortcuts row (polling only). Exposes the textareaRef via defineExpose
  so the container's `useCursorInsert` composable can target it for
  click-to-insert from the source-tree panels.

  Communicates via v-model on the script string + a `select-path` emit
  when the user clicks a watched-path chip. No state owned — the
  container holds `scriptContent`.
*/

defineProps<{
  modelValue: string;
  isPolling: boolean;
  watchedPaths: string[];
}>();

defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "select-path", path: string): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
defineExpose({ textareaRef });

// Local helper — same dot-path → handlebars conversion the cursor composable
// uses, but inline here so the chip title shows what will be inserted.
const pathToHandlebars = (path: string): string =>
  path
    .split(".")
    .map((seg) => (/^\d+$/.test(seg) ? `[${seg}]` : seg))
    .join(".");
</script>

<template>
  <div class="code-block">
    <div class="code-header">
      <span class="dot dot-red" /><span class="dot dot-yellow" /><span
        class="dot dot-green"
      />
      <span class="code-title">{{ $t("formatEditor.scriptTitle") }}</span>
    </div>

    <div v-if="isPolling && watchedPaths.length > 0" class="shortcuts">
      <span class="shortcuts-label">{{
        $t("formatEditor.watchedPathsLabel")
      }}</span>
      <button
        v-for="p in watchedPaths"
        :key="p"
        type="button"
        class="shortcut-chip"
        :title="
          $t('formatEditor.watchedPathsInsertTitle', {
            token: `{{${pathToHandlebars(p)}}}`,
          })
        "
        @click="$emit('select-path', p)"
      >
        {{ p }}
      </button>
    </div>

    <textarea
      ref="textareaRef"
      :value="modelValue"
      class="editor-textarea hbs-color"
      spellcheck="false"
      @input="
        $emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />
  </div>
</template>

<style scoped>
/* Watched-path chips — specific to this panel; not a design-system primitive. */
.shortcuts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-code-soft);
  border-bottom: 1px solid var(--color-bg-code);
}
.shortcuts-label {
  color: var(--color-text-dim);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: var(--font-weight-bold);
  margin-right: var(--space-1);
}
.shortcut-chip {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.shortcut-chip:hover {
  background: var(--color-accent-hover);
  color: var(--color-text-on-accent);
}
</style>
