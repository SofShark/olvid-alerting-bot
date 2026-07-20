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
      title="Load template payload"
      @click="
        $emit(
          'open-load',
          ($event.currentTarget as HTMLElement).getBoundingClientRect(),
        )
      "
    >
      <span>Load Template</span>
      <span class="caret" aria-hidden="true" />
    </button>
    <span class="toolbar-divider" aria-hidden="true" />
    <button
      class="toggle-btn"
      title="Picker Mode"
      @click="$emit('toggle-picker')"
    >
      <img
        src="../../../assets/eyedrop.png"
        alt="Picker Mode"
        class="eyedrop-icon"
      />
    </button>
    <button class="toggle-btn" title="Prettify JSON" @click="$emit('prettify')">
      { }
    </button>
    <button class="toggle-btn" title="Clear Payload" @click="$emit('clear')">
      Clear
    </button>
  </div>
</template>

<style scoped>
.payload-toolbar {
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-items: center;
}
.toolbar-divider {
  width: 1px;
  height: 18px;
  background: #3a3a3a;
  margin: 0 4px;
}
.eyedrop-icon {
  width: 14px;
  height: 14px;
  display: flex;
}
</style>
