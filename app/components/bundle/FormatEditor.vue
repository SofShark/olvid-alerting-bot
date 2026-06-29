<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { formatMessage } from "#shared/handlebars";
import { Source, isPollingSource } from "#shared/types/source";
import { ConditionKind } from "#shared/types/condition";
import { PollingFormat } from "#shared/types/polling";
import { migrateCondition } from "#shared/condition/migrate";
import {
  webhookTemplateList,
  getWebhookPayloadJson,
  getWebhookScript,
  type WebhookTemplate,
} from "#shared/payloadTemplates";

const { t } = useI18n();

const props = defineProps({
  initialScript: { type: String, default: "" },
  inputSource: { type: String, default: Source.Webhook },
  alertParams: { type: Object, default: () => ({}) },
  alertId: { type: Number as () => number | null, default: null },
});

const emit = defineEmits(["save", "close"]);

const isPolling = computed(() => isPollingSource(props.inputSource));

// Seed from `initialScript` so re-opening the editor on a saved bundle shows
// the persisted Handlebars template. The editor is mounted fresh on every
// open (parent uses `v-if="isEditorOpen"`), so reading the prop once at
// construction time is the right place — no watcher needed.
const scriptContent = ref(props.initialScript ?? "");
const scriptTextareaRef = ref<HTMLTextAreaElement | null>(null);

// ── Webhook payload (JSON) state ─────────────────────────────────────────────
const jsonPayload = ref("");
const parsedJson = computed(() => {
  if (!jsonPayload.value.trim()) return null;
  try {
    return JSON.parse(jsonPayload.value);
  } catch {
    return null;
  }
});
const jsonRootEntries = computed<Array<[string, any]>>(() => {
  const p = parsedJson.value;
  if (!p || typeof p !== "object") return [];
  return Array.isArray(p)
    ? p.map((v, i) => [String(i), v]) // [0], [1], … become the top-level "keys"
    : Object.entries(p);
});
const lastPayloadLoading = ref(false);
const lastPayloadMissing = ref(false);
const pickerMode = ref(false); // click-to-insert mode for JSON payload

// ── Dropdown States ──────────────────────────────────────────────────────────
const quickTemplatesOpen = ref(false);
const loadDataOpen = ref(false);

// Closes every dropdown — used by the click-outside backdrop and by
// any action that should dismiss the menus (load template, save, etc.).
const closeDropdowns = () => {
  quickTemplatesOpen.value = false;
  loadDataOpen.value = false;
};

// ── Load Template dropdown positioning ─────────────────────────────────────
// The button sits inside the payload code-block (which has overflow:hidden,
// so a regular absolute-positioned dropdown would clip). The dropdown is
// teleported to <body>; we calculate its top + right from the button's
// bounding rect when it opens so it visually anchors under the button.
const loadTemplateBtnRef = ref<HTMLButtonElement | null>(null);
const loadTemplateDropdownStyle = ref<Record<string, string>>({});

const positionLoadTemplateDropdown = async () => {
  await nextTick();
  const rect = loadTemplateBtnRef.value?.getBoundingClientRect();
  if (!rect) return;
  loadTemplateDropdownStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    "z-index": "10510",
  };
};

const toggleLoadData = () => {
  loadDataOpen.value = !loadDataOpen.value;
  if (loadDataOpen.value) positionLoadTemplateDropdown();
};

// ── Webhook Toolbar Functions ────────────────────────────────────────────────
const formatJson = () => {
  try {
    if (!jsonPayload.value.trim()) return;
    const parsed = JSON.parse(jsonPayload.value);
    jsonPayload.value = JSON.stringify(parsed, null, 2);
  } catch (e) {
    alert("Invalid JSON: Cannot prettify.");
  }
};

const clearPayloadPanel = () => {
  jsonPayload.value = "";
  lastPayloadMissing.value = false;
};

// Library load: fill the JSON panel from the registry, then ask whether to
// also apply the matching Handlebars script (overwrites current script).
const loadLibraryPayload = (id: WebhookTemplate["id"]) => {
  const payloadJson = getWebhookPayloadJson(id);
  if (payloadJson === null) return;
  jsonPayload.value = payloadJson;
  lastPayloadMissing.value = false;
  closeDropdowns();

  // Small delay so Vue paints the new payload before the confirm steals focus.
  setTimeout(() => {
    const script = getWebhookScript(id);
    if (!script) return;
    const label = webhookTemplateList.find((t) => t.id === id)?.label ?? id;
    if (
      window.confirm(
        `Loaded the ${label} payload. Apply its matching Handlebars template too? (This overwrites your current script.)`,
      )
    ) {
      scriptContent.value = script;
    }
  }, 50);
};

// Fetch the most recent payload for this alert from the server — either
// the last successful one (when ?type=success) or the last failed one
// (?type=failed). Returns null if the alert is brand new (no id yet) or
// nothing has been received for it.
async function loadLastPayload(type: "success" | "failed") {
  closeDropdowns();
  if (!props.alertId) {
    alert("This alert hasn't been saved yet. No payloads in database.");
    return;
  }
  lastPayloadLoading.value = true;
  lastPayloadMissing.value = false;
  try {
    const res = await $fetch<{ payload: any }>(
      `/api/payloads?type=${type}&alertId=${props.alertId}`,
    );
    if (res.payload) {
      jsonPayload.value = JSON.stringify(res.payload, null, 2);
    } else {
      lastPayloadMissing.value = true;
      jsonPayload.value = "";
    }
  } catch {
    lastPayloadMissing.value = true;
    jsonPayload.value = "";
  } finally {
    lastPayloadLoading.value = false;
  }
}

// ── Polling source (XML tree) state ─────────────────────────────────────────
const parsedTree = ref<any>(null);
const pollingLoading = ref(false);
const pollingError = ref("");

const rootEntries = computed<Array<[string, any]>>(() =>
  parsedTree.value ? Object.entries(parsedTree.value) : [],
);

const watchedPaths = computed<string[]>(() => {
  const c = migrateCondition(props.alertParams?.condition);
  return c.kind === ConditionKind.Rule ? c.paths : [];
});

async function retrievePolling() {
  const url = props.alertParams?.url;
  const format = props.alertParams?.format ?? PollingFormat.XML;
  if (!url) {
    pollingError.value = t("formatEditor.errors.noUrlPolling");
    return;
  }
  pollingLoading.value = true;
  pollingError.value = "";
  try {
    const res: any = await $fetch("/api/poll/retrieve", {
      method: "POST",
      body: { url, format },
    });
    if (!res.ok) {
      pollingError.value =
        res.error ?? t("formatEditor.errors.failedToRetrieveSource");
      parsedTree.value = null;
    } else {
      parsedTree.value = res.parsed;
    }
  } catch (e: any) {
    pollingError.value =
      e?.data?.statusMessage ??
      e?.message ??
      t("conditionEditor.errors.networkError");
  } finally {
    pollingLoading.value = false;
  }
}

// ── Click-to-insert path into the Handlebars template ──────────────────────
function pathToHandlebars(path: string): string {
  return path
    .split(".")
    .map((seg) => (/^\d+$/.test(seg) ? `[${seg}]` : seg))
    .join(".");
}

function insertAtCursor(text: string) {
  const ta = scriptTextareaRef.value;
  if (!ta) {
    scriptContent.value += text;
    return;
  }
  const start = ta.selectionStart ?? scriptContent.value.length;
  const end = ta.selectionEnd ?? scriptContent.value.length;
  const before = scriptContent.value.slice(0, start);
  const after = scriptContent.value.slice(end);
  scriptContent.value = before + text + after;
  nextTick(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
  });
}

function onPathSelect(path: string) {
  insertAtCursor(`{{${pathToHandlebars(path)}}}`);
}

// ── Live preview ────────────────────────────────────────────────────────────
const previewData = computed(() => {
  if (!scriptContent.value || scriptContent.value.trim() === "") {
    return { text: t("formatEditor.preview.placeholder"), error: null };
  }
  let context: any;
  if (isPolling.value) {
    context = parsedTree.value ?? {};
  } else {
    try {
      context = JSON.parse(jsonPayload.value);
    } catch (err) {
      return {
        text: "",
        error: t("formatEditor.errors.jsonError", {
          message: (err as Error).message,
        }),
      };
    }
  }
  try {
    const msg = formatMessage(scriptContent.value, context);
    return {
      text: msg
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n-/g, "\n•"),
      error: null,
    };
  } catch (err) {
    return {
      text: "",
      error: t("formatEditor.errors.handlebarsError", {
        message: (err as Error).message,
      }),
    };
  }
});

const save = () => emit("save", scriptContent.value);
const close = () => emit("close");
</script>

<template>
  <!-- Modal overlay: fixed full-viewport scrim + centered window. The
       parent (BundleCard) controls mounting via v-if. -->
  <div class="editor-overlay">
    <div
      v-if="quickTemplatesOpen || loadDataOpen"
      class="dropdown-backdrop"
      @click="closeDropdowns"
    ></div>

    <div class="editor-window">
      <div class="window-header">
        <div class="header-titles">
          <h3>{{ $t("formatEditor.title") }}</h3>
          <p v-if="isPolling">{{ $t("formatEditor.intro.polling") }}</p>
          <p v-else>{{ $t("formatEditor.intro.webhook") }}</p>
        </div>

        <button
          class="btn-close-icon"
          :title="$t('formatEditor.buttons.closeTitle')"
          @click="close"
        >
          ✕
        </button>
      </div>

      <div class="window-body">
        <div class="code-column">
          <!-- Script editor -->
          <div class="code-block">
            <div class="code-header">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span
                class="dot dot-green"
              />
              <span class="code-title">{{
                $t("formatEditor.scriptTitle")
              }}</span>
            </div>

            <!-- Shortcuts row: watched paths from the alert's condition. Polling only. -->
            <div v-if="isPolling && watchedPaths.length > 0" class="shortcuts">
              <span class="shortcuts-label">{{
                $t("formatEditor.watchedPathsLabel")
              }}</span>
              <button
                v-for="p in watchedPaths"
                :key="p"
                type="button"
                class="shortcut-chip"
                :title="
                  $t('formatEditor.watchedPathsInsertTitle', {
                    token: `{{${pathToHandlebars(p)}}}`,
                  })
                "
                @click="onPathSelect(p)"
              >
                {{ p }}
              </button>
            </div>

            <textarea
              ref="scriptTextareaRef"
              v-model="scriptContent"
              class="editor-textarea hbs-color"
              spellcheck="false"
            />
          </div>

          <!-- Source pane: XML tree (polling) OR JSON payload (webhook). -->
          <div class="code-block">
            <div class="code-header">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span
                class="dot dot-green"
              />
              <span class="code-title">
                {{
                  isPolling
                    ? $t("formatEditor.sourceTitlePollingFormat", {
                        format: (alertParams?.format ?? "xml").toLowerCase(),
                      })
                    : "payload.json (Test Data)"
                }}
              </span>

              <!-- Polling: refresh button -->
              <button
                v-if="isPolling"
                type="button"
                class="payload-refresh"
                :disabled="pollingLoading"
                :title="$t('formatEditor.sourceRefreshTitle')"
                @click="retrievePolling"
              >
                {{ pollingLoading ? "…" : "⟳" }}
              </button>

              <!-- Webhook: Toolbar Overhaul -->
              <div v-else class="payload-toolbar">
                <button
                  ref="loadTemplateBtnRef"
                  type="button"
                  class="toggle-btn toggle-btn-wide"
                  :class="{ 'is-open': loadDataOpen }"
                  :aria-expanded="loadDataOpen"
                  title="Load template payload"
                  @click="toggleLoadData"
                >
                  <span>Load Template</span>
                  <span class="caret" aria-hidden="true" />
                </button>
                <span class="toolbar-divider" aria-hidden="true" />
                <button
                  class="toggle-btn"
                  title="Picker Mode"
                  @click="pickerMode = !pickerMode"
                >
                  <img
                    src="../../assets/eyedrop.png"
                    alt="Picker Mode"
                    class="eyedrop-icon"
                  />
                </button>
                <button
                  class="toggle-btn"
                  title="Prettify JSON"
                  @click="formatJson"
                >
                  { }
                </button>
                <button
                  class="toggle-btn"
                  title="Clear Payload"
                  @click="clearPayloadPanel"
                >
                  Clear
                </button>
              </div>
            </div>

            <!-- Polling: XML tree -->
            <template v-if="isPolling">
              <div class="payload-notice" v-if="pollingLoading">
                {{ $t("formatEditor.sourceLoadingPolling") }}
              </div>
              <div class="payload-empty" v-else-if="pollingError">
                ⚠ {{ pollingError }}
              </div>
              <div class="payload-empty" v-else-if="rootEntries.length === 0">
                {{ $t("formatEditor.sourceEmptyPolling") }}
              </div>
              <div v-else class="tree-panel">
                <XmlTreeNode
                  v-for="[k, v] in rootEntries"
                  :key="k"
                  :node-name="k"
                  :node-value="v"
                  :path="k"
                  :selected="[]"
                  @select="onPathSelect"
                />
              </div>
            </template>

            <template v-else-if="pickerMode">
              <div v-if="lastPayloadLoading" class="payload-notice">
                {{ $t("formatEditor.sourceLoadingWebhook") }}
              </div>
              <div v-else-if="lastPayloadMissing" class="payload-empty">
                {{ $t("formatEditor.sourceNoPayloads") }}
              </div>
              <div v-else class="tree-panel">
                <JsonTreeNode
                  v-for="[k, v] in jsonRootEntries"
                  :key="k"
                  :node-name="k"
                  :node-value="v"
                  :path="k"
                  @select="onPathSelect"
                />
              </div>
            </template>

            <!-- Webhook: JSON textarea (Editable) -->
            <template v-else>
              <div v-if="lastPayloadLoading" class="payload-notice">
                {{ $t("formatEditor.sourceLoadingWebhook") }}
              </div>
              <div v-else-if="lastPayloadMissing" class="payload-empty">
                {{ $t("formatEditor.sourceNoPayloads") }}
              </div>
              <textarea
                v-else
                v-model="jsonPayload"
                class="editor-textarea json-color"
                spellcheck="false"
              />
            </template>
          </div>
        </div>

        <div class="preview-column">
          <div class="chat-header">
            {{ $t("formatEditor.preview.title") }}
          </div>
          <div class="chat-background">
            <div v-if="previewData.error" class="error-bubble">
              ⚠️ {{ previewData.error }}
            </div>
            <div v-else class="chat-bubble">
              <div class="bubble-sender">
                {{ $t("formatEditor.preview.sender") }}
              </div>
              <div class="bubble-text" v-html="previewData.text" />
              <div class="bubble-time">
                {{ $t("formatEditor.preview.time") }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="window-footer">
        <button type="button" class="btn btn-ghost" @click="close">
          {{ $t("formatEditor.buttons.cancel") }}
        </button>
        <button type="button" class="btn btn-primary" @click="save">
          {{ $t("formatEditor.buttons.save") }}
        </button>
      </div>
    </div>

    <!-- ── Load Template dropdown ─────────────────────────────────────
         Teleported to body so the .code-block's `overflow: hidden`
         doesn't clip it. Position is computed from the button's
         bounding rect on each open. -->
    <Teleport to="body">
      <div
        v-if="loadDataOpen"
        class="template-dropdown"
        :style="loadTemplateDropdownStyle"
      >
        <div class="template-section">
          <div class="template-section-label">From database</div>
          <button class="template-item" @click="loadLastPayload('success')">
            <span class="status-pip pip-ok" aria-hidden="true" />
            <span class="template-item-label">Last successful payload</span>
          </button>
          <button class="template-item" @click="loadLastPayload('failed')">
            <span class="status-pip pip-fail" aria-hidden="true" />
            <span class="template-item-label">Last failed payload</span>
          </button>
        </div>
        <div class="template-section">
          <div class="template-section-label">From library</div>
          <button
            v-for="t in webhookTemplateList"
            :key="t.id"
            class="template-item"
            @click="loadLibraryPayload(t.id)"
          >
            <span class="template-item-label">{{ t.label }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Dropdown / Toolbars Styles ────────────────────────────────────────── */
/* Backdrop covers the whole viewport AND the editor-window so a click
 * anywhere outside the open dropdown closes it. Z-index sits above the
 * editor-window (10502) but below the teleported dropdown (which lives
 * at the body root with z-index 10510). */
.dropdown-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10509;
}
.title-with-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
/*
.btn-quick-template {
  background: var(--color-bg-card); color: var(--color-accent);
  border: 1px solid var(--color-accent); border-radius: var(--radius-sm);
  padding: 4px 10px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.btn-quick-template:hover { background: var(--color-accent-soft); }
*/
/* "Load Template" — extends .toggle-btn (dark IDE chrome) with extra
 * horizontal padding so the label fits, plus a caret that rotates on
 * open. Sits on the LEFT of the payload toolbar as the primary action;
 * a thin divider separates it from the utility buttons (picker / { } /
 * Clear). Visually unmistakable as "the main toolbar action" without
 * breaking the dark code-block look. */
.toggle-btn-wide {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px var(--space-3);
  font-weight: 600;
  letter-spacing: 0.1px;
}
.toggle-btn-wide .caret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  margin-top: 1px;
  opacity: 0.7;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}
.toggle-btn-wide.is-open {
  background: #4a4a4a;
  color: var(--color-text-code);
  border-color: #6b6b6b;
}
.toggle-btn-wide.is-open .caret {
  transform: rotate(180deg);
  opacity: 1;
}

/* Vertical hairline between Load Template and the utility buttons —
 * groups the toolbar into "primary" + "utilities" without adding a
 * separate container. */
.toolbar-divider {
  width: 1px;
  height: 18px;
  background: #3a3a3a;
  margin: 0 4px;
}

/* ── Dropdown menu ────────────────────────────────────────────────
 * Two visually-grouped sections (Database / Library) separated by an
 * inner divider. Items have a left accent-bar reveal on hover so the
 * eye lands precisely on the focused row.
 */
.template-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 260px;
  padding: 6px 0;
  background: #1e1e22;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 12px 32px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  font-family: inherit;
}
.template-dropdown.right-aligned {
  left: auto;
  right: 0;
}

.template-section {
  padding: 4px 0 6px;
}
.template-section + .template-section {
  border-top: 1px solid #2c2c30;
  margin-top: 2px;
  padding-top: 8px;
}

.template-section-label {
  padding: 4px 16px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: #71717a;
}

.template-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 16px 8px 18px;
  background: transparent;
  color: #d4d4d8;
  border: none;
  border-left: 2px solid transparent;
  text-align: left;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    border-color 0.12s ease;
}
.template-item:hover {
  background: #2a2a30;
  color: #fff;
  border-left-color: var(--color-accent, #3b82f6);
}
.template-item:focus-visible {
  outline: none;
  background: #2a2a30;
  color: #fff;
  border-left-color: var(--color-accent, #3b82f6);
}

.template-item-label {
  flex: 1;
  min-width: 0;
}

/* Tiny coloured dot signaling DB row health — replaces the 🟢 / 🔴 emoji. */
.status-pip {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.04);
}
.pip-ok {
  background: #22c55e;
}
.pip-fail {
  background: #ef4444;
}

.payload-toolbar {
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-items: center;
}

/* ── Modal shell ────────────────────────────────────────────────────────────
 * Fixed full-viewport overlay with a centered fixed-size window. The
 * parent (BundleCard) mounts this via v-if. Click-on-backdrop closes
 * (handled by @click.self="close" on the overlay).
 */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
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
  padding: var(--space-5) var(--space-7);
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
  margin: 4px 0 0 0;
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

.window-footer {
  padding: var(--space-5) var(--space-7);
  background: var(--color-border-subtle);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  flex-shrink: 0;
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

.code-block {
  min-height: 0;
  max-height: none;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

.code-header {
  display: flex;
  align-items: center;
  padding: var(--space-3) 15px;
  background: #1e1e1e;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom: 1px solid #333;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  display: inline-block;
}
.dot-red {
  background-color: #ff5f56;
}
.dot-yellow {
  background-color: #ffbd2e;
}
.dot-green {
  background-color: #27c93f;
}
.code-title {
  color: #858585;
  font-family: var(--font-mono);
  font-size: 13px;
  margin-left: 10px;
}

.toggle-btn {
  background: #3a3a3a;
  color: #a3a3a3;
  border: 1px solid #555;
  border-radius: var(--radius-sm);
  padding: 3px var(--space-4);
  font-size: var(--text-md);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.toggle-btn:hover {
  background: #4a4a4a;
  color: var(--color-text-code);
}

.eyedrop-icon {
  width: 14px;
  height: 14px;
  display: flex;
}
.payload-refresh {
  background: #3a3a3a;
  color: #a3a3a3;
  border: 1px solid #555;
  width: 28px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-lg);
  cursor: pointer;
  margin-left: auto;
}
.payload-refresh:hover:not(:disabled) {
  background: #4a4a4a;
  color: var(--color-text-on-accent);
}
.payload-refresh:disabled {
  opacity: 0.4;
  cursor: wait;
}

.payload-notice {
  background: var(--color-bg-code-header);
  color: var(--color-warning);
  font-size: var(--text-md);
  font-family: var(--font-mono);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid #3a3a3a;
}
.payload-empty {
  background: var(--color-bg-code);
  color: var(--color-text-dim);
  font-size: var(--text-base);
  font-family: var(--font-mono);
  padding: 30px var(--space-5);
  text-align: center;
  flex: 1;
}

.editor-textarea {
  width: 100%;
  padding: var(--space-6);
  background: var(--color-bg-code);
  border: none;
  outline: none;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.hbs-color {
  color: #dcdcaa;
  min-height: 150px;
}
.json-color {
  color: #9cdcfe;
  min-height: 250px;
}

.editor-textarea::-webkit-scrollbar {
  width: 8px;
}
.editor-textarea::-webkit-scrollbar-thumb {
  background: #4b4b4b;
  border-radius: var(--radius-sm);
}

.tree-panel::-webkit-scrollbar {
  width: 8px;
}
.tree-panel::-webkit-scrollbar-thumb {
  background: #4b4b4b;
  border-radius: var(--radius-sm);
}

/* ── Watched-path shortcuts (polling only) ──────────────────────── */
.shortcuts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-code-soft);
  border-bottom: 1px solid var(--color-bg-code);
}
.shortcuts-label {
  color: var(--color-text-dim);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 700;
  margin-right: var(--space-1);
}
.shortcut-chip {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.shortcut-chip:hover {
  background: #1e3a8a;
  color: var(--color-text-on-accent);
}

/* ── XML tree pane (polling only) ───────────────────────────────── */
.tree-panel {
  padding: var(--space-4);
  background: var(--color-bg-code);
  overflow-y: auto;
  min-height: 250px;
  max-height: 360px;
}

/* ── Preview column ─────────────────────────────────────────────── */
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
