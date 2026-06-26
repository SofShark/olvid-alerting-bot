<script setup lang="ts">
import { ref } from 'vue'
import { pollingService } from '~/utils/pollingService'

const t = useI18n().t

// Shared label helpers live in app/composables/. Centralising the
// Formatting → human label switch here means a single source of truth
// (was duplicated in AlertEditor + here pre-refactor).
const { formatLabel } = useFormatLabel()

const props = defineProps<{
  alertId: number | null
}>()

const testing    = ref(false)
const testResult = ref<any>(null)

const runTestPoll = async () => {
  if (!props.alertId) return
  testing.value = true
  try {
    testResult.value = await pollingService.testOnScreen(props.alertId)
  } catch (error: any) {
    testResult.value = {
      ok: false,
      error: error?.data?.statusMessage ?? error?.message ?? t('editor.errors.testFailed')
    }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="test-panel">
    <p class="test-intro">
        {{ $t('editor.testPanel.intro') }}
    </p>
    <button
        type="button"
        class="btn btn-secondary btn-sm test-btn"
        :disabled="testing"
        @click="runTestPoll"
    >
      {{ testing ? $t('editor.testPanel.pollingButton') : $t('editor.testPanel.runButton') }}
    </button>
  </div>

  <div v-if="testResult" class="overlay" @click.self="testResult = null">
    <div class="overlay-box test-modal">
      <div class="modal-head">
        <h4>{{ $t('editor.testModal.title') }}</h4>
        <button type="button" class="modal-close" :title="$t('editor.bundleModal.closeTitle')" @click="testResult = null">✕</button>
      </div>

      <div class="modal-body">
        <div v-if="testResult.error" class="test-error">
          ⚠ {{ testResult.error }}
        </div>

        <template v-else>

          <!-- Verdict card — the top-line answer: did this poll fire? -->
          <div
            class="verdict-card"
            :class="testResult.condition?.fired ? 'fired' : 'not-fired'"
          >
            <div class="verdict-row">
              <span class="verdict-badge">
                <span class="verdict-dot" aria-hidden="true" />
                <span v-if="testResult.condition?.fired">FIRED</span>
                <span v-else>DID NOT FIRE</span>
              </span>
              <span class="verdict-headline">
                {{ testResult.condition?.fired
                    ? $t('editor.testModal.conditionMet')
                    : $t('editor.testModal.conditionNotMet') }}
              </span>
            </div>
            <p v-if="testResult.condition?.reason" class="verdict-reason">
              {{ testResult.condition.reason }}
            </p>
          </div>

          <!-- Per-field breakdown — collapsed by default so the verdict
               + bundle messages dominate the screen on first open. -->
          <details v-if="testResult.condition?.baselineValue?.length" class="result-section collapsible">
            <summary class="result-section-title">
              {{ $t('editor.testModal.perFieldBreakdown') }}
              <span class="result-count">({{ testResult.condition.baselineValue.length }})</span>
            </summary>
            <ul class="verdict-list">
              <li
                  v-for="(v, i) in testResult.condition.baselineValue"
                  :key="i"
                  :class="v.fired ? 'fired' : 'not-fired'"
                >
                  <span class="verdict-icon">{{ v.fired ? '✓' : '✗' }}</span>
                  <code class="verdict-path">{{ v.path }}</code>
                  <span class="verdict-detail">{{ v.detail }}</span>
                </li>
            </ul>
          </details>

          <!-- Per-bundle messages — one box per bundle. -->
          <section v-if="testResult.bundleMessages?.length" class="result-section">
            <h5 class="result-section-title">
              {{ $t('editor.view.dividers.messagesPerBundle') }}
              <span class="result-count">({{ testResult.bundleMessages.length }})</span>
            </h5>
            <div class="bundle-messages">
              <div
                v-for="bm in testResult.bundleMessages"
                :key="bm.index"
                class="bundle-message"
              >
                <div class="bundle-message-head">
                  <span class="bundle-tag">{{ $t('editor.view.bundleTag', { n: bm.index + 1 }) }}</span>
                  <span class="bundle-message-meta">
                    {{ bm.discussionCount === 1
                        ? $t('editor.testModal.discussionsCount',       { n: bm.discussionCount })
                        : $t('editor.testModal.discussionsCountPlural', { n: bm.discussionCount }) }}
                    · {{ formatLabel(bm.formating) }}
                  </span>
                </div>
                <pre v-if="!bm.error" class="bundle-message-body">{{ bm.message }}</pre>
                <pre v-else class="bundle-message-error">⚠ {{ bm.error }}</pre>
              </div>
            </div>
          </section>

          <!-- Raw parsed payload — collapsed by default; debug surface. -->
          <details class="test-raw">
            <summary>{{ $t('editor.testModal.parsedSourceRaw') }}</summary>
            <pre>{{ JSON.stringify(testResult.parsed, null, 2) }}</pre>
          </details>
        </template>
      </div>

    </div>
  </div>
</template>   

<style scoped>  
/* ── Test poll panel ────────────────────────────── */
.test-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start; /* Changed from center to flex-start to align with typical layouts */
  padding: var(--space-4) 0;
}
.test-intro { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); line-height: 1.5; }
.test-btn   { align-self: flex-start; }

.test-error { color: var(--color-danger-bright); font-size: var(--text-md); font-family: var(--font-mono); }

/* ── Modal shell ─────────────────────────────────────────────────
 * Wider than the bundle-edit modal because content here is dense:
 * verdict card, per-field breakdown, multiple bundle messages, raw
 * payload. 92vw on small screens, capped at 1080px on big ones so
 * line lengths stay readable.
 *
 * NOTE: .modal-head / .modal-close styles are scoped here because
 * TestPoll lives in its own SFC — the AlertEditor's modal-head CSS
 * doesn't apply across component boundaries. Without these rules
 * the title + close X render unstyled (browser defaults).
 */
.test-modal {
  width: 92vw;
  max-width: 1080px;
  max-height: 90vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.modal-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}
.modal-head h4 {
  margin: 0;
  flex: 1;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  min-width: 0;
}
.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: var(--text-lg);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color .15s, color .15s;
  flex-shrink: 0;
}
.modal-close:hover {
  background: var(--color-border-default);
  color: var(--color-text-primary);
}

.test-modal .modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Verdict card ────────────────────────────────────────────────
 * Big at-a-glance answer: FIRED / DID NOT FIRE + headline phrase +
 * the evaluator's reason. Background tinted per state. */
.verdict-card {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-bg-card-soft);
  border: 1px solid var(--color-border-subtle);
  border-left-width: 4px;
}
.verdict-card.fired      { border-left-color: var(--color-success); background: var(--color-success-soft); }
.verdict-card.not-fired  { border-left-color: var(--color-text-dim); }

.verdict-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.verdict-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 4px var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  flex-shrink: 0;
}
.verdict-card.fired     .verdict-badge { color: var(--color-success); }
.verdict-card.not-fired .verdict-badge { color: var(--color-text-dim); }

.verdict-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.verdict-headline {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
}

.verdict-reason {
  margin: var(--space-3) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

/* ── Result section (per-field, per-bundle, …) ────────────────────
 * Each major content area gets a small-caps title + body. Sections
 * that are wrapped in <details> use .collapsible — the summary
 * doubles as the section title and the native triangle disclosure
 * is restyled to fit. */
.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.result-section-title {
  margin: 0;
  padding-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-text-dim);
  border-bottom: 1px solid var(--color-border-subtle);
}
.result-count {
  color: var(--color-text-faint);
  font-weight: 600;
  margin-left: var(--space-1);
}

/* Collapsible variant — used for per-field breakdown so the modal
 * stays compact when there are many rows. */
.result-section.collapsible {
  gap: 0;
}
.result-section.collapsible > summary {
  cursor: pointer;
  user-select: none;
  list-style: none;          /* hide native marker */
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.result-section.collapsible > summary::-webkit-details-marker { display: none; }
.result-section.collapsible > summary::before {
  content: '';
  width: 0;
  height: 0;
  border-left:  4px solid transparent;
  border-right: 4px solid transparent;
  border-top:   5px solid currentColor;
  margin-right: 4px;
  opacity: 0.6;
  transform: rotate(-90deg);
  transition: transform .15s ease;
}
.result-section.collapsible[open] > summary::before {
  transform: rotate(0deg);
}
.result-section.collapsible > .verdict-list {
  margin-top: var(--space-3);
}

/* Per-field breakdown — checkmark / cross + path + detail */
.verdict-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.verdict-list li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}
.verdict-icon {
  font-weight: 700;
  font-size: var(--text-base);
  width: 1ch;
}
.verdict-list li.fired      .verdict-icon { color: var(--color-success); }
.verdict-list li.not-fired  .verdict-icon { color: var(--color-text-dim); }
.verdict-path {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-accent-text);
  background: var(--color-border-subtle);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
.verdict-detail {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Per-bundle messages — boxed code-like preview of the rendered string */
.bundle-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.bundle-message {
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-card);
}
.bundle-message-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-card-soft);
  border-bottom: 1px solid var(--color-border-subtle);
}
.bundle-message-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.bundle-tag { font-weight: 600; font-size: var(--text-sm); }
.bundle-message-body {
  margin: 0;
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-code);
  color: var(--color-text-code);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow-y: auto;
}
.bundle-message-error {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-danger-soft);
  color: var(--color-danger-bright);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: pre-wrap;
}

/* Raw details */
.test-raw { color: var(--color-text-dim); font-size: var(--text-md); margin-top: var(--space-4); }
.test-raw summary { cursor: pointer; user-select: none; padding: 2px 0; font-weight: 600; }
.test-raw summary:hover { color: var(--color-accent-text); }
.test-raw pre {
  margin: var(--space-2) 0 0;
  padding: var(--space-4);
  background: var(--color-bg-code);
  border-radius: var(--radius-sm);
  color: var(--color-text-code);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  max-height: 240px;
  overflow: auto;
}

</style>