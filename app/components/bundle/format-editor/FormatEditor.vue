<script setup lang="ts">
import { ref, computed, toRef } from "vue";
import {
  Source,
  isPolling as isPollingSource,
  isMonitoring as isMonitoringSource,
} from "#shared/types/source";
import { BundleOutputType } from "#shared/types/bundleOutput";
import type { WebhookTemplateId } from "~~/shared/payloadTemplates";

/*
  Smart container for the Handlebars script editor modal. Mounts the
  shell (overlay + window + header + footer) and composes:
    - 4 composables for state / IO:
        useFormatEditorPayload   webhook side (jsonPayload, loaders, …)
        useFormatEditorPolling   polling side (parsedTree, retrieve, …)
        useFormatEditorPreview   derived render of the chat bubble
        useCursorInsert          textarea cursor helper (click-to-insert)
    - 5 dumb panels:
        ScriptPanel              Handlebars textarea + watched-paths chips
        PayloadPanel             XML tree / JSON tree / JSON textarea (mode-branched)
        PreviewPanel             rendered chat bubble (read-only)
        LoadTemplate             teleported Load Template dropdown
        (PayloadToolbar is nested inside PayloadPanel for the webhook case.)

  No business logic in this file — only wiring: read prop, route emits
  to composable methods, pass derived values down to children.
*/

const props = defineProps({
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

const isPolling = computed(() => isPollingSource(props.inputSource));
const isMonitoring = computed(() => isMonitoringSource(props.inputSource));

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

// LoadTemplate emits the bundled template's id. The payload composable
// returns the matching script string when the user confirms applying it;
// the container is responsible for writing it back to `scriptContent`.
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
  <div class="editor-overlay">
    <div class="editor-window">
      <div class="window-header">
        <div class="header-titles">
          <h3>{{ $t("formatEditor.title") }}</h3>
          <p v-if="isPolling">{{ $t("formatEditor.intro.polling") }}</p>
          <p v-else-if="isMonitoring">
            {{ $t("formatEditor.intro.monitoring") }}
          </p>
          <p v-else>{{ $t("formatEditor.intro.webhook") }}</p>
        </div>
        <button
          class="btn-close-icon"
          :title="$t('formatEditor.buttons.closeTitle')"
          @click="onClose"
        >✕</button>
      </div>

      <div class="window-body">
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

      <div class="window-footer">
        <button type="button" class="btn btn-ghost" @click="onClose">
          {{ $t("formatEditor.buttons.cancel") }}
        </button>
        <button type="button" class="btn btn-primary" @click="onSave">
          {{ $t("formatEditor.buttons.save") }}
        </button>
      </div>
    </div>

    <LoadTemplate
      :open="loadOpen"
      :anchor="loadAnchor"
      @select-last="onSelectLast"
      @select-template="onSelectTemplate"
      @close="closeLoad"
    />
  </div>
</template>

<style scoped>
/* Modal chrome — fixed full-viewport scrim + centered window. The parent
 * (BundleCard) controls mounting via v-if. Click-on-overlay does NOT close;
 * the user has to click Cancel / X (consistent with other modals in the app
 * that own unsaved state). */
.editor-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--color-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10500;
  font-family: var(--font-sans);
}

.editor-window {
  background: var(--color-bg-panel);
  width: 98vw;
  max-width: 1600px;
  height: 96vh;
  border-radius: 12px;
  box-shadow: var(--shadow-overlay);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  position: relative;
  z-index: 10502;
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-7);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-border-subtle);
}
.header-titles {
  flex: 1;
  min-width: 0;
}
.header-titles h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: 700;
}
.header-titles p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 14px;
  max-width: 720px;
}

.btn-close-icon {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: var(--text-xl);
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
}
.btn-close-icon:hover {
  color: var(--color-danger);
}

.window-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  background: var(--color-bg-card);
  flex-grow: 1;
  overflow: hidden;
}

.code-column {
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  overflow-y: auto;
  border-right: 1px solid var(--color-border-subtle);
}

.window-footer {
  padding: var(--space-5) var(--space-7);
  background: var(--color-border-subtle);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  flex-shrink: 0;
}
</style>
