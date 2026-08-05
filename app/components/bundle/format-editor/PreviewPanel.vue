<script setup lang="ts">
import { BundleOutputType } from "#shared/types/bundle";

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
/* Right column of the editor grid — the seam with the code column is
 * already drawn by .code-column's border-right; this column doesn't
 * add its own border to avoid a doubled 2px seam. Internal scroll on
 * min-height:0 so long previews don't push the footer off-screen. */
.preview-column {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card-soft);
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Panel eyebrow, matching the section-eyebrow idiom used elsewhere
 * (see AlertLogs.vue). Uppercase tracking + muted text so it reads
 * as a label, not a title. */
.chat-header {
  padding: var(--space-4) var(--space-6);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border-subtle);
}
</style>
