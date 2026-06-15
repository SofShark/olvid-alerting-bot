<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Handlebars from 'handlebars'
import {
  sampleData,
  Source,
  isPollingSource,
  ConditionKind,
  PollingFormat,
  migrateCondition,
} from '#shared/constants'

const props = defineProps({
  initialScript: { type: String, default: '' },
  inputSource:   { type: String, default: Source.GenericWebhook },
  /** Polling alerts pass triggerParams so the editor can retrieve the live source
   *  and offer shortcut chips for the configured watched paths. */
  triggerParams: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['save', 'close'])

const isPolling = computed(() => isPollingSource(props.inputSource))

const scriptContent     = ref('')
const scriptTextareaRef = ref<HTMLTextAreaElement | null>(null)

// ── Webhook payload (JSON) state ─────────────────────────────────────────────
const jsonPayload        = ref('')
const payloadType        = ref<'example' | 'last'>('example')
const lastPayloadLoading = ref(false)
const lastPayloadMissing = ref(false)

function loadExamplePayload(source: string) {
  const data = sampleData[source as Source] ?? sampleData[Source.GenericWebhook]
  jsonPayload.value = JSON.stringify(data.payload, null, 2)
  lastPayloadMissing.value = false
}

async function loadLastPayload(source: string) {
  lastPayloadLoading.value = true
  lastPayloadMissing.value = false
  try {
    const res = await $fetch<{ payload: any }>(`/api/payloads?source=${encodeURIComponent(source)}&type=last`)
    if (res.payload) {
      jsonPayload.value = JSON.stringify(res.payload, null, 2)
      lastPayloadMissing.value = false
    } else {
      lastPayloadMissing.value = true
      jsonPayload.value = ''
    }
  } catch {
    lastPayloadMissing.value = true
    jsonPayload.value = ''
  } finally {
    lastPayloadLoading.value = false
  }
}

async function refreshPayload(source: string, type: 'example' | 'last') {
  if (type === 'last') await loadLastPayload(source)
  else                  loadExamplePayload(source)
}

// ── Polling source (XML tree) state ─────────────────────────────────────────
const parsedTree      = ref<any>(null)
const pollingLoading  = ref(false)
const pollingError    = ref('')

const rootEntries = computed<Array<[string, any]>>(() =>
  parsedTree.value ? Object.entries(parsedTree.value) : []
)

const watchedPaths = computed<string[]>(() => {
  const c = migrateCondition(props.triggerParams?.condition)
  return c.kind === ConditionKind.Rule ? c.paths : []
})

async function retrievePolling() {
  const url    = props.triggerParams?.url
  const format = props.triggerParams?.format ?? PollingFormat.XML
  if (!url) {
    pollingError.value = 'No URL configured for this alert — set one in the alert\'s polling configuration.'
    return
  }
  pollingLoading.value = true
  pollingError.value   = ''
  try {
    const res: any = await $fetch('/api/poll/retrieve', {
      method: 'POST',
      body: { url, format },
    })
    if (!res.ok) {
      pollingError.value = res.error ?? 'Failed to retrieve source'
      parsedTree.value   = null
    } else {
      parsedTree.value = res.parsed
    }
  } catch (e: any) {
    pollingError.value = e?.data?.statusMessage ?? e?.message ?? 'Network error'
  } finally {
    pollingLoading.value = false
  }
}

// ── Click-to-insert path into the Handlebars template ──────────────────────
//   - dotted path → Handlebars expression
//   - numeric segments get bracket syntax: foo.0.bar → {{foo.[0].bar}}
function pathToHandlebars(path: string): string {
  return path
    .split('.')
    .map(seg => /^\d+$/.test(seg) ? `[${seg}]` : seg)
    .join('.')
}

function insertAtCursor(text: string) {
  const ta = scriptTextareaRef.value
  if (!ta) {
    scriptContent.value += text
    return
  }
  const start = ta.selectionStart ?? scriptContent.value.length
  const end   = ta.selectionEnd   ?? scriptContent.value.length
  const before = scriptContent.value.slice(0, start)
  const after  = scriptContent.value.slice(end)
  scriptContent.value = before + text + after
  nextTick(() => {
    ta.focus()
    ta.selectionStart = ta.selectionEnd = start + text.length
  })
}

function onPathSelect(path: string) {
  insertAtCursor(`{{${pathToHandlebars(path)}}}`)
}

// ── Lifecycle / source switching ─────────────────────────────────────────────
watch(() => props.inputSource, (source) => {
  payloadType.value = 'example'
  if (!props.initialScript || props.initialScript === '') {
    const data = sampleData[source as Source] ?? sampleData[Source.GenericWebhook]
    scriptContent.value = data.script
  } else {
    scriptContent.value = props.initialScript
  }
  if (isPolling.value) {
    retrievePolling()
  } else {
    loadExamplePayload(source)
  }
}, { immediate: true })

watch(payloadType, (type) => {
  if (!isPolling.value) refreshPayload(props.inputSource, type)
})

// ── Live preview ────────────────────────────────────────────────────────────
const previewData = computed(() => {
  if (!scriptContent.value || scriptContent.value.trim() === '') {
    return { text: 'Formatted message will appear here...', error: null }
  }
  let context: any
  if (isPolling.value) {
    context = parsedTree.value ?? {}
  } else {
    try { context = JSON.parse(jsonPayload.value) }
    catch (err) { return { text: '', error: 'Error in JSON: ' + (err as Error).message } }
  }
  try {
    const template = Handlebars.compile(scriptContent.value)
    return {
      text:  template(context).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
      error: null,
    }
  } catch (err) {
    return { text: '', error: 'Error in Handlebars: ' + (err as Error).message }
  }
})

const save  = () => emit('save', scriptContent.value)
const close = () => emit('close')
</script>

<template>
  <div class="editor-overlay" @click.self="close">
    <div class="editor-window">

      <div class="window-header">
        <div class="header-titles">
          <h3>Custom Format Editor</h3>
          <p v-if="isPolling">
            Build the message that fires when this polling alert triggers. Click
            any value on the right to insert its path, or use the watched-path
            shortcuts below the script.
          </p>
          <p v-else>
            Configure the message that users will receive on Olvid.
          </p>
        </div>
        <button class="btn-close-icon" @click="close">✕</button>
      </div>

      <div class="window-body">

        <div class="code-column">

          <!-- Script editor -->
          <div class="code-block">
            <div class="code-header">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
              <span class="code-title">script.hbs (Handlebars)</span>
            </div>

            <!-- Shortcuts row: watched paths from the alert's condition. Polling only. -->
            <div
              v-if="isPolling && watchedPaths.length > 0"
              class="shortcuts"
            >
              <span class="shortcuts-label">Watched paths:</span>
              <button
                v-for="p in watchedPaths"
                :key="p"
                type="button"
                class="shortcut-chip"
                :title="`Insert {{${pathToHandlebars(p)}}}`"
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
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
              <span class="code-title">
                {{ isPolling ? `source.${(triggerParams?.format ?? 'xml').toLowerCase()}` : 'payload.json (Test Data)' }}
              </span>

              <!-- Polling: refresh button -->
              <button
                v-if="isPolling"
                type="button"
                class="payload-refresh"
                :disabled="pollingLoading"
                title="Re-fetch the source"
                @click="retrievePolling"
              >
                {{ pollingLoading ? '…' : '⟳' }}
              </button>

              <!-- Webhook: Example / Last received toggle -->
              <div v-else class="payload-toggle">
                <button
                  :class="['toggle-btn', { active: payloadType === 'example' }]"
                  @click="payloadType = 'example'"
                >Example</button>
                <button
                  :class="['toggle-btn', { active: payloadType === 'last' }]"
                  @click="payloadType = 'last'"
                >Last received</button>
              </div>
            </div>

            <!-- Polling: XML tree -->
            <template v-if="isPolling">
              <div class="payload-notice" v-if="pollingLoading">
                Loading source…
              </div>
              <div class="payload-empty" v-else-if="pollingError">
                ⚠ {{ pollingError }}
              </div>
              <div class="payload-empty" v-else-if="rootEntries.length === 0">
                No data yet.
              </div>
              <div v-else class="tree-pane">
                <p class="tree-pane-hint">
                  Click any value to insert its path into the script.
                </p>
                <XmlTreeNode
                  v-for="([k, v]) in rootEntries"
                  :key="k"
                  :node-name="k"
                  :node-value="v"
                  :path="k"
                  :selected="[]"
                  @select="onPathSelect"
                />
              </div>
            </template>

            <!-- Webhook: JSON textarea (unchanged) -->
            <template v-else>
              <div v-if="lastPayloadLoading" class="payload-notice">Loading…</div>
              <div v-else-if="lastPayloadMissing" class="payload-empty">
                No payloads from this input source have been received yet.
              </div>
              <textarea
                v-else
                :value="jsonPayload"
                class="editor-textarea json-color"
                readonly
                spellcheck="false"
              />
            </template>
          </div>

        </div>

        <div class="preview-column">
          <div class="chat-header">
            📱 Preview on device
          </div>
          <div class="chat-background">
            <div v-if="previewData.error" class="error-bubble">
              ⚠️ {{ previewData.error }}
            </div>
            <div v-else class="chat-bubble">
              <div class="bubble-sender">Alerting Bot</div>
              <div class="bubble-text" v-html="previewData.text" />
              <div class="bubble-time">now</div>
            </div>
          </div>
        </div>

      </div>

      <div class="window-footer">
        <button type="button" class="btn-cancel" @click="close">Cancel</button>
        <button type="button" class="btn-save" @click="save">Save Script</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* The FormatEditor modal is INTENTIONALLY light — it sits over a dimmed
 * dark backdrop so the user feels they've focused into a dedicated editor.
 * Its shell colors stay hard-coded (they don't theme with the app) — only
 * the accent and the dark code-blocks inside use design tokens.
 */

.editor-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 10500;
  font-family: var(--font-sans);
}

.editor-window {
  background: #ffffff;
  width: 98vw;
  max-width: 1600px;
  height: 96vh;
  border-radius: 12px;
  box-shadow: var(--shadow-overlay);
  display: flex; flex-direction: column;
  overflow: hidden;
}

.window-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-7) 30px;
  border-bottom: 1px solid #e2e8f0;
}
.header-titles h3 { margin: 0; color: #0f172a; font-size: var(--text-xl); font-weight: 700; }
.header-titles p  { margin: 4px 0 0 0; color: #64748b; font-size: 14px; max-width: 720px; }

.btn-close-icon {
  background: transparent; border: none; color: #94a3b8;
  font-size: var(--text-xl);
  cursor: pointer; transition: color 0.2s;
}
.btn-close-icon:hover { color: var(--color-danger); }

.window-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f1f5f9;
  flex-grow: 1;
  overflow: hidden;
}

.code-column {
  padding: var(--space-7);
  display: flex; flex-direction: column; gap: var(--space-7);
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
}

/* Code-blocks here override the global min/max-height — they live inside
 * the fixed-height modal and need to size to their content. */
.code-block {
  min-height: 0;
  max-height: none;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

/* Toggle pills + refresh button live in the code-block header. They're
 * dark-on-dark like the rest of the IDE chrome. */
.payload-toggle { display: flex; gap: var(--space-1); margin-left: auto; }
.toggle-btn {
  background: #3a3a3a; color: #a3a3a3;
  border: 1px solid #555; border-radius: var(--radius-sm);
  padding: 3px var(--space-4); font-size: var(--text-md); cursor: pointer;
  transition: background-color .15s, color .15s;
}
.toggle-btn:hover { background: #4a4a4a; color: var(--color-text-code); }
.toggle-btn.active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
  border-color: var(--color-accent);
}

.payload-refresh {
  background: #3a3a3a;
  color: #a3a3a3;
  border: 1px solid #555;
  width: 28px; height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-lg);
  cursor: pointer;
  margin-left: auto;
}
.payload-refresh:hover:not(:disabled) { background: #4a4a4a; color: var(--color-text-on-accent); }
.payload-refresh:disabled { opacity: 0.4; cursor: wait; }

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
  border: none; outline: none;
  font-family: var(--font-mono);
  font-size: 14px; line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}
.hbs-color  { color: #dcdcaa; min-height: 150px; }
.json-color { color: #9cdcfe; min-height: 250px; }

.editor-textarea::-webkit-scrollbar { width: 8px; }
.editor-textarea::-webkit-scrollbar-thumb { background: #4b4b4b; border-radius: var(--radius-sm); }

/* ── Watched-path shortcuts (polling only) ──────────────────────── */
.shortcuts {
  display: flex; flex-wrap: wrap; align-items: center;
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
  transition: background-color .15s, color .15s;
}
.shortcut-chip:hover { background: #1e3a8a; color: var(--color-text-on-accent); }

/* ── XML tree pane (polling only) ───────────────────────────────── */
.tree-pane {
  padding: var(--space-4);
  background: var(--color-bg-code);
  overflow-y: auto;
  min-height: 250px;
  max-height: 360px;
}
.tree-pane-hint {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: #0a0a0a;
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-accent-text);
  font-size: var(--text-sm);
}

/* ── Preview column (chat bubble — light by design) ─────────────── */
.preview-column { display: flex; flex-direction: column; background: #e5e5ea; }
.chat-header {
  background: #f8fafc; padding: var(--space-6);
  text-align: center; font-weight: bold; color: #475569;
  border-bottom: 1px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.chat-background { padding: var(--space-7); flex-grow: 1; overflow-y: auto; }
.chat-bubble {
  background: #ffffff;
  max-width: 85%;
  padding: var(--space-4) var(--space-6);
  border-radius: 0 16px 16px 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  margin-bottom: var(--space-6);
}
.bubble-sender { color: var(--color-accent); font-weight: 700; font-size: var(--text-base); margin-bottom: 5px; }
.bubble-text   { margin: 0; font-family: inherit; font-size: var(--text-lg); color: #111827; white-space: pre-wrap; line-height: 1.4; }
.bubble-time   { text-align: right; color: #9ca3af; font-size: var(--text-sm); margin-top: 5px; }

.error-bubble {
  background: #fef2f2; color: #991b1b;
  max-width: 85%;
  padding: var(--space-4) var(--space-6);
  border-radius: 16px; border: 1px solid #f87171;
  font-family: var(--font-mono); font-size: var(--text-base);
  white-space: pre-wrap;
}

.window-footer {
  padding: var(--space-6) 30px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  display: flex; justify-content: flex-end; gap: var(--space-6);
}
.btn-cancel {
  background: #f1f5f9; color: #475569;
  border: none; padding: var(--space-4) var(--space-7); border-radius: var(--radius-xl);
  font-weight: 600; cursor: pointer; transition: background-color 0.2s;
}
.btn-cancel:hover { background: #e2e8f0; }

.btn-save {
  background: var(--color-accent); color: var(--color-text-on-accent);
  border: none; padding: var(--space-4) var(--space-8); border-radius: var(--radius-xl);
  font-weight: 600; cursor: pointer; transition: background-color 0.2s;
}
.btn-save:hover { background: var(--color-accent-hover); }
</style>
