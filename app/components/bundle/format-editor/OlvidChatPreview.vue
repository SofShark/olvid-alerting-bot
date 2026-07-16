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
  border-radius: 0 16px 16px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  margin-bottom: var(--space-6);
  border: 1px solid var(--color-border-subtle);
  overflow-wrap: break-word;
  word-break: break-word;
}
.bubble-sender {
  color: var(--color-accent);
  font-weight: 700;
  font-size: var(--text-base);
  margin-bottom: 5px;
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
  margin-top: 5px;
}
.error-bubble {
  background: var(--color-danger-soft);
  color: var(--color-danger-bright);
  max-width: 85%;
  padding: var(--space-4) var(--space-6);
  border-radius: 16px;
  border: 1px solid var(--color-danger-border);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  white-space: pre-wrap;
}
</style>
