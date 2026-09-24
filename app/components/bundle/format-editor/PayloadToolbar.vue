<script setup lang="ts">
defineProps<{
  loadOpen: boolean;
}>();

defineEmits<{
  (e: "toggle-load"): void;
  (e: "toggle-picker"): void;
  (e: "prettify"): void;
  (e: "clear"): void;
}>();
</script>

<template>
  <div class="payload-toolbar">
    <button
      type="button"
      class="code-toggle-btn code-toggle-btn-wide"
      :class="{ 'is-open': loadOpen }"
      :aria-expanded="loadOpen"
      :title="$t('formatEditor.toolbar.loadTemplateTitle')"
      @click="$emit('toggle-load')"
    >
      <span>{{ $t('formatEditor.toolbar.loadTemplate') }}</span>
      <span class="caret" aria-hidden="true" />
    </button>
    <span class="toolbar-divider" aria-hidden="true" />
    <button
      class="code-toggle-btn"
      :title="$t('formatEditor.toolbar.pickerMode')"
      :aria-label="$t('formatEditor.toolbar.pickerMode')"
      @click="$emit('toggle-picker')"
    >
      <LucidePipette :stroke-width="2" class="toolbar-icon" />
    </button>
    <button
      class="code-toggle-btn"
      :title="$t('formatEditor.toolbar.prettify')"
      :aria-label="$t('formatEditor.toolbar.prettify')"
      @click="$emit('prettify')"
    >
      { }
    </button>
    <button
      class="code-toggle-btn"
      :title="$t('formatEditor.toolbar.clear')"
      @click="$emit('clear')"
    >
      {{ $t('formatEditor.toolbar.clear') }}
    </button>
  </div>
</template>

<style scoped>
.payload-toolbar {
  display: flex;
  gap: var(--space-3);
  margin-left: auto;
  align-items: center;
}

.toolbar-icon {
  width: 14px;
  height: 14px;
  display: block;
}
</style>
