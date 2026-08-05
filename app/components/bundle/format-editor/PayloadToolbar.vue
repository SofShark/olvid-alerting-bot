<script setup lang="ts">
/*
  Webhook-only toolbar that sits inside the PayloadPanel's code-header.
  Emits semantic intents only — never owns state.

  `open-load` carries the trigger button's DOMRect so the container can
  position the teleported LoadTemplate dropdown without needing a ref
  chain through PayloadPanel.
*/

defineProps<{
  loadOpen: boolean;
}>();

defineEmits<{
  (e: "open-load", anchor: DOMRect): void;
  (e: "toggle-picker"): void;
  (e: "prettify"): void;
  (e: "clear"): void;
}>();
</script>

<template>
  <div class="payload-toolbar">
    <button
      type="button"
      class="toggle-btn toggle-btn-wide"
      :class="{ 'is-open': loadOpen }"
      :aria-expanded="loadOpen"
      :title="$t('formatEditor.toolbar.loadTemplateTitle')"
      @click="
        $emit(
          'open-load',
          ($event.currentTarget as HTMLElement).getBoundingClientRect(),
        )
      "
    >
      <span>{{ $t('formatEditor.toolbar.loadTemplate') }}</span>
      <span class="caret" aria-hidden="true" />
    </button>
    <span class="toolbar-divider" aria-hidden="true" />
    <button
      class="toggle-btn"
      :title="$t('formatEditor.toolbar.pickerMode')"
      :aria-label="$t('formatEditor.toolbar.pickerMode')"
      @click="$emit('toggle-picker')"
    >
      <LucidePipette :stroke-width="2" class="toolbar-icon" />
    </button>
    <button
      class="toggle-btn"
      :title="$t('formatEditor.toolbar.prettify')"
      :aria-label="$t('formatEditor.toolbar.prettify')"
      @click="$emit('prettify')"
    >
      { }
    </button>
    <button
      class="toggle-btn"
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
.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border-subtle);
  margin: 0 var(--space-1);
}
.toolbar-icon {
  width: 14px;
  height: 14px;
  display: block;
}
</style>
