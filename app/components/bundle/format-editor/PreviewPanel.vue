<script setup lang="ts">
import { BundleOutputType } from "#shared/types/bundleOutput";

/*
  Right-hand pane. Delegates the actual rendering to a variant component
  based on `mode`:
    · olvid → OlvidChatPreview (chat bubble)
    · mail  → MailPreview      (email frame)

  This file only owns the shared shell — the pane's column, the header
  bar, and the mode-appropriate title. Adding a new channel means a new
  Preview*.vue and one case here.
*/

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    data: { text: string; error: string | null };
    /** Channel to render the preview for. Defaults to Olvid so callers
     *  that don't yet pass a mode keep working. */
    mode?: BundleOutputType;
    /** Mail-only helpers surfaced through the panel. Ignored for olvid. */
    mailFrom?: string;
    mailTo?: string;
    mailSubject?: string;
  }>(),
  { mode: BundleOutputType.Olvid },
);

const headerTitle = computed(() =>
  props.mode === BundleOutputType.Mail
    ? t("formatEditor.preview.mailTitle")
    : t("formatEditor.preview.title"),
);
</script>

<template>
  <div class="preview-column">
    <div class="chat-header">{{ headerTitle }}</div>
    <OlvidChatPreview v-if="mode === BundleOutputType.Olvid" :data="data" />
    <MailPreview
      v-else-if="mode === BundleOutputType.Mail"
      :data="data"
      :from="mailFrom"
      :to="mailTo"
      :subject="mailSubject"
    />
  </div>
</template>

<style scoped>
.preview-column {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card-soft);
  border-left: 1px solid var(--color-border-subtle);
}
.chat-header {
  background: var(--color-bg-panel);
  padding: var(--space-6);
  text-align: center;
  font-weight: bold;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-subtle);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>
