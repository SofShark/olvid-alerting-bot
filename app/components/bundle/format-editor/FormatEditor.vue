<script setup lang="ts">
import { ref, computed } from "vue";
import { Source } from "#shared/types/source";
import { BundleOutputType } from "#shared/types/bundle";
import type { WebhookTemplateId } from "~~/shared/payloadTemplates";

/*
  Smart container for the Handlebars script editor. Composes:
    - 4 composables for state / IO:
        useFormatEditorPayload   webhook side (jsonPayload, loaders, …)
        useFormatEditorPolling   polling side (parsedTree, retrieve, …)
        useFormatEditorMonitoring monitoring side (probe, retrieve, …)
        useFormatEditorPreview   derived render of the chat bubble
        useCursorInsert          textarea cursor helper (click-to-insert)
    - 5 dumb panels:
        ScriptPanel              Handlebars textarea + watched-paths chips
        PayloadPanel             XML tree / JSON tree / JSON textarea (mode-branched)
        PreviewPanel             rendered chat bubble / mail card
        LoadTemplate             teleported Load Template dropdown

  Chrome is delegated to the app-wide <Modal size="editor"> + <ModalHead>
  primitives so the editor lives on the same stacking / focus / a11y
  contract as every other dialog in the app. `editor` is the widest
  shell (96vw × 92vh, cap 1600px) — sized specifically for two-column
  code editors where narrower would starve the preview column.
  Callers pass `open` and listen to `close` — no bespoke overlay.
*/

const props = defineProps({
  open: { type: Boolean, default: false },
  initialScript: { type: String, default: "" },
  inputSource: { type: String, default: Source.Webhook },
  alertParams: { type: Object, default: () => ({}) },
  alertId: { type: Number as () => number | null, default: null },
  /** Channel the bundle delivers to — drives the preview's flavor
   *  (chat bubble vs email frame). Defaults to Olvid for callers that
   *  don't yet pass it. */
  previewMode: {
    type: String as () => BundleOutputType,
    default: BundleOutputType.Olvid,
  },
  /** Optional labels for the mail preview's From / Subject rows —
   *  ignored when previewMode is olvid. */
  mailFrom: { type: String, default: undefined },
  mailSubject: { type: String, default: undefined },
});

const emit = defineEmits(["save", "close"]);

const isPolling = computed(() => props.inputSource === Source.Polling);
const isMonitoring = computed(() => props.inputSource === Source.Monitoring);

const { t } = useI18n();
const formatHint = computed(() => {
  if (isPolling.value) return t("formatEditor.intro.polling");
  else if (isMonitoring.value) return t("formatEditor.intro.monitoring");
  else return t("formatEditor.intro.webhook");
});

// Seed from `initialScript` so re-opening the editor on a saved bundle shows
// the persisted Handlebars template. The editor is mounted fresh on every
// open (parent uses `v-if`), so reading the prop once at construction time
// is the right place — no watcher needed.
const scriptContent = ref(props.initialScript ?? "");

// ── Composables ────────────────────────────────────────────────────────────
// One state composable per source (polling / monitoring / webhook). Only
// the one matching the active source is used by PayloadPanel; the others
// idle. Cheap enough to instantiate all three unconditionally.
const payload = useFormatEditorPayload(() => props.alertId);
const polling = useFormatEditorPolling(() => props.alertParams);
const monitoring = useFormatEditorMonitoring(() => props.alertParams);
const preview = useFormatEditorPreview({
  scriptContent,
  isPolling,
  isMonitoring,
  parsedTree: polling.parsedTree,
  monitorProbe: monitoring.probe,
  jsonPayload: payload.jsonPayload,
});

// ScriptPanel exposes `textareaRef` via defineExpose so the cursor helper
// can target the real DOM element. The getter resolves it lazily, so it
// stays correct even if the panel re-mounts.
const scriptPanelRef = ref<{ textareaRef: HTMLTextAreaElement | null } | null>(
  null,
);
const cursor = useCursorInsert(
  () => scriptPanelRef.value?.textareaRef ?? null,
  () => scriptContent.value,
  (v) => {
    scriptContent.value = v;
  },
);

// ── Local UI state ─────────────────────────────────────────────────────────
const pickerMode = ref(false); // toggle inside PayloadToolbar (webhook only)
const loadOpen = ref(false); // Load Template dropdown
const loadAnchor = ref<DOMRect | null>(null); // computed from the toolbar button

// ── Event routing ──────────────────────────────────────────────────────────
const onOpenLoad = (rect: DOMRect) => {
  loadAnchor.value = rect;
  loadOpen.value = true;
};
const closeLoad = () => {
  loadOpen.value = false;
};

const onSelectTemplate = (id: string) => {
  const script = payload.loadLibraryPayload(id as WebhookTemplateId);
  if (script) scriptContent.value = script;
  closeLoad();
};
const onSelectLast = (type: "success" | "failed") => {
  payload.loadLastPayload(type);
  closeLoad();
};

const onSave = () => emit("save", scriptContent.value);
const onClose = () => emit("close");
</script>

<template>
  <Modal
    :open="open"
    size="editor"
    :close-on-backdrop="false"
    :aria-label="$t('formatEditor.title')"
    @close="onClose"
  >
    <ModalHead
      variant="filled"
      :title="$t('formatEditor.title')"
      :close-label="$t('formatEditor.buttons.closeTitle')"
      @close="onClose"
    >
      <template #actions>
        <HelpTooltip :message="formatHint" />
      </template>
    </ModalHead>

    <div class="editor-body">
      <div class="code-column">
        <ScriptPanel
          ref="scriptPanelRef"
          v-model="scriptContent"
          :is-polling="isPolling"
          :watched-paths="polling.watchedPaths.value"
          @select-path="cursor.onPathSelect"
        />

        <PayloadPanel
          :is-polling="isPolling"
          :is-monitoring="isMonitoring"
          :picker-mode="pickerMode"
          :format="alertParams?.format ?? 'xml'"
          :polling-loading="polling.pollingLoading.value"
          :polling-error="polling.pollingError.value"
          :root-entries="polling.rootEntries.value"
          :monitor-loading="monitoring.monitorLoading.value"
          :monitor-error="monitoring.monitorError.value"
          :monitor-probe="monitoring.probe.value"
          :monitor-root-entries="monitoring.rootEntries.value"
          :json-payload="payload.jsonPayload.value"
          :json-root-entries="payload.jsonRootEntries.value"
          :last-payload-loading="payload.lastPayloadLoading.value"
          :last-payload-missing="payload.lastPayloadMissing.value"
          :load-open="loadOpen"
          @update:json-payload="payload.jsonPayload.value = $event"
          @select-path="cursor.onPathSelect"
          @retrieve="polling.retrievePolling"
          @retrieve-monitor="monitoring.retrieveMonitor"
          @open-load="onOpenLoad"
          @toggle-picker="pickerMode = !pickerMode"
          @prettify="payload.formatJson"
          @clear="payload.clearPayloadPanel"
        />
      </div>

      <PreviewPanel
        :data="preview.previewData.value"
        :mode="previewMode"
        :mail-from="mailFrom"
        :mail-subject="mailSubject"
      />
    </div>

    <div class="editor-footer">
      <button type="button" class="btn btn-ghost" @click="onClose">
        {{ $t("formatEditor.buttons.cancel") }}
      </button>
      <button type="button" class="btn btn-primary" @click="onSave">
        {{ $t("formatEditor.buttons.save") }}
      </button>
    </div>

    <LoadTemplate
      :open="loadOpen"
      :anchor="loadAnchor"
      @select-last="onSelectLast"
      @select-template="onSelectTemplate"
      @close="closeLoad"
    />
  </Modal>
</template>

<style scoped>
/* All chrome (overlay, focus trap, teleport, size caps) is owned by
 * <Modal size="editor"> — this file only styles the panel layout inside
 * it. Three horizontal bands: the filled ModalHead at the top, the
 * two-column editor body in the middle, the button footer at the
 * bottom. Each band uses a slightly different surface token so the
 * eye reads the structure without needing heavy borders. */

.editor-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  background: var(--color-bg-panel);
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--color-border-subtle);
}

/* Left column — script + payload panels stacked vertically. Padding
 * matches the modal's outer rhythm (--space-7) so the panels sit
 * within a comfortable "IDE margin". Internal scroll so long payloads
 * never push the footer off-screen. */
.code-column {
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--color-border-subtle);
  min-width: 0; /* let the grid column shrink so children can wrap */
}

/* Footer — mirrors the header's filled treatment so the frame looks
 * intentional (band-body-band), and gives the primary/secondary
 * buttons enough room to breathe. flex-shrink:0 keeps it visible even
 * when the body scrolls to its bounds. */
.editor-footer {
  padding: var(--space-4) var(--space-7);
  background: var(--color-bg-card-soft);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0;
}
</style>
