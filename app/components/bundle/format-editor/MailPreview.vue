<script setup lang="ts">
/*
  Right-hand pane variant for mail bundles — reading-view style.

  Design principles borrowed from the OlvidChatPreview bubble:
    · One elevated card floating in a padded background.
    · Subject is the headline (largest, bold, primary); the mail metadata
      is a single muted meta-line beneath it, not a form-style table.
    · Body sits below with generous line-height and prose-friendly type
      so the content takes center stage.

  From / To field labels have been retired — a preview isn't an SMTP
  header dump; the subject + sender line carry enough context. The
  actual send-time recipient list is visible in the bundle editor row
  right next to the FormatEditor, so surfacing it again here would be
  noise.

  `data.text` is the RAW Handlebars output. Mail is an HTML transport,
  so we render it via `v-html`: any `<strong>` / `<em>` / `<br>` the user
  wrote in the script paints as real formatting. Plain-text markup like
  `**bold**` shows literally, matching what MailPace actually sends for
  a script that only uses markdown-lite syntax without HTML tags.
  Delivery-time `notifierService` strips HTML for the Olvid dispatch of
  the same bundle — the two previews render each channel accordingly.
*/

defineProps<{
  data: { text: string; error: string | null };
  /** Sender label. Falls back to a generic placeholder if the caller
   *  doesn't know it — the preview is illustrative, not authoritative. */
  from?: string;
  /** Retained for backward-compat with `PreviewPanel`'s prop passthrough,
   *  no longer surfaced in the UI. */
  to?: string;
  subject?: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="mail-background">
    <div v-if="data.error" class="error-bubble">⚠️ {{ data.error }}</div>
    <article v-else class="mail-card">
      <header class="mail-head">
        <div class="mail-subject-block">
          <span class="mail-label">{{
            t("formatEditor.mailPreview.subject")
          }}</span>
          <p class="mail-subject">
            {{ subject || t("formatEditor.mailPreview.subjectPlaceholder") }}
          </p>
        </div>
        <p class="mail-meta">
          <span class="mail-from">{{
            from || t("formatEditor.mailPreview.fromPlaceholder")
          }}</span>
          <span class="mail-dot" aria-hidden="true">·</span>
          <span class="mail-time">{{ t("formatEditor.preview.time") }}</span>
        </p>
      </header>
      <div class="mail-body" v-html="data.text" />
    </article>
  </div>
</template>

<style scoped>
/* Container matches OlvidChatPreview's `.chat-background` so both
 * variants breathe identically inside PreviewPanel. */
.mail-background {
  padding: var(--space-7);
  flex-grow: 1;
  overflow-y: auto;
}

/* One elevated card, no internal dividers — spacing separates zones.
 * Border-radius / shadow / border tuned to feel like a sibling of the
 * chat bubble, not an alien form window. */
.mail-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-card);
  padding: var(--space-6) var(--space-7);
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Head zone — subject block on the left, meta on the right, separated
 * from the body by margin (no rule). Reads as an email header without
 * table-like scaffolding. */
.mail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.mail-subject-block {
  min-width: 0;
  flex: 1;
}

/* Tiny uppercase label — mirrors the app's field-label idiom
 * (`TITLE`, `CHANNEL`, …) so the value below reads as a labelled
 * field, not a page title. */
.mail-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 2px;
}

/* Subject value — bold reading-size, primary. Not a headline anymore,
 * so no `text-xl`; sized so it reads as a mail subject line, comfortably
 * next to the meta line. */
.mail-subject {
  /* Same size as the body — hierarchy comes from weight plus the
   * uppercase label above, not from being visually bigger than the
   * message content. */
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-tight);
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Sender · time — same weight/size as the app's dim helper text so it
 * feels native rather than form-derived. */
.mail-meta {
  margin: 0;
  color: var(--color-text-dim);
  font-size: var(--text-s);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding-top: var(--space-5); /* aligns with the subject baseline after the label */
}
.mail-from {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}
.mail-dot {
  color: var(--color-text-faint);
}

/* Body is the star — larger reading font + generous line-height +
 * whitespace-preserving so the formatter's newlines survive. */
.mail-body {
  color: var(--color-text-primary);
  font-size: var(--text-lg);
  line-height: 1.4;
  white-space: pre-wrap;
}

/* Inline tags kept readable */
.mail-body :deep(strong) {
  font-weight: var(--font-weight-bold);
}
.mail-body :deep(em),
.mail-body :deep(i) {
  font-style: italic;
}
.mail-body :deep(s) {
  text-decoration: line-through;
}
.mail-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.95em;
  padding: 2px var(--space-2);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
}

/* Same error surface as OlvidChatPreview so failure feedback is
 * consistent across channels. */
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
