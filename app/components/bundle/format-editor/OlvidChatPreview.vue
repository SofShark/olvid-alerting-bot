<script setup lang="ts">
/*
  Right-hand pane variant: chat-style bubble showing the rendered Handlebars
  output. Extracted from the former PreviewPanel so a sibling `MailPreview`
  can plug into the same slot for mail bundles. Purely visual — render text
  comes in pre-computed from `useFormatEditorPreview`.
*/

defineProps<{
  data: { text: string; error: string | null };
}>();
</script>

<template>
  <div class="chat-background">
    <div v-if="data.error" class="error-bubble">⚠️ {{ data.error }}</div>
    <div v-else class="chat-bubble">
      <div class="bubble-sender">{{ $t("formatEditor.preview.sender") }}</div>
      <div class="bubble-text" v-html="data.text" />
      <div class="bubble-time">{{ $t("formatEditor.preview.time") }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-background {
  padding: var(--space-7);
  flex-grow: 1;
  overflow-y: auto;
}
.chat-bubble {
  background: var(--color-bg-panel);
  max-width: 85%;
  width: fit-content;
  padding: var(--space-4) var(--space-6);
  /* Asymmetric corner leaves the bottom-left flat — anchors the
   * "sent by the app" chat bubble to the left rail of the pane. */
  border-radius: var(--radius-3xl) var(--radius-3xl) var(--radius-3xl) 0;
  box-shadow: var(--shadow-card);
  margin-bottom: var(--space-6);
  border: 1px solid var(--color-border-subtle);
  overflow-wrap: break-word;
  word-break: break-word;
}
.bubble-sender {
  color: var(--color-accent);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-base);
  margin-bottom: var(--space-2);
}
.bubble-text {
  margin: 0;
  font-family: inherit;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
  white-space: pre-wrap;
  line-height: 1.4;
}
.bubble-time {
  text-align: right;
  color: var(--color-text-dim);
  font-size: var(--text-sm);
  margin-top: var(--space-2);
}
.error-bubble {
  background: var(--color-danger-soft);
  color: var(--color-danger-bright);
  max-width: 85%;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-3xl);
  border: 1px solid var(--color-danger-border);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  white-space: pre-wrap;
}
</style>
