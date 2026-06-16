<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  ConditionKind,
  ConditionOperator,
  ConditionAggregation,
  PollingFormat,
  OPERATORS_NEEDING_VALUE,
  migrateCondition,
  type PollingCondition,
} from '#shared/constants'

const props = defineProps<{
  modelValue?: PollingCondition
  url?:        string
  format?:     string
}>() 

const emit = defineEmits<{
  (e: 'update:modelValue', v: PollingCondition): void
  (e: 'update:payload',    v: any): void
}>()

// ── Normalize incoming condition to the new shape ──────────────────────────
const current = computed<PollingCondition>(
  () => migrateCondition(props.modelValue),
)

const kind = computed(() => current.value.kind)

// Cached rule state — preserved across mode switches so the user doesn't
// lose their selections when toggling to "Fire every poll cycle" by accident.
// TODO Better preserve all fiels in Polling Condition and then erase if at save kind results to be none?
const savedRule = ref({
  paths:       [] as string[],
  operator:    ConditionOperator.Changed,
  value:       '',
  aggregation: ConditionAggregation.All,
})

// Whenever the parent gives us a Rule, refresh savedRule so manual edits
// (typing in the value field, etc.) are remembered across mode toggles.
watch(current, (c) => {
  if (c.kind === ConditionKind.Rule) {
    savedRule.value = {
      paths:       c.paths,
      operator:    c.operator,
      value:       c.value ?? '',
      aggregation: c.aggregation ?? ConditionAggregation.All,
    }
  }
}, { immediate: true })

// `rule` is what the rule controls read from. When the parent has switched
// to None, we still display savedRule so the chips, operator, etc. remain
// visible (the controls are disabled by the mode radio anyway).
const rule = computed(() =>
  current.value.kind === ConditionKind.Rule ? current.value : savedRule.value,
)

const paths       = computed(() => rule.value.paths)
const operator    = computed(() => rule.value.operator)
const literal     = computed(() => rule.value.value ?? '')
const aggregation = computed(() => rule.value.aggregation ?? ConditionAggregation.All)

const needsValue = computed(() => OPERATORS_NEEDING_VALUE.has(operator.value))

// Emit a new rule, merging only the changed bits. If the user is currently
// in "None" mode, any change switches us to "Rule" mode automatically.
function patchRule(patch: Partial<{ paths: string[]; operator: ConditionOperator; value: string; aggregation: ConditionAggregation }>) {
  const next = {
    kind:        ConditionKind.Rule as const,
    paths:       patch.paths       ?? paths.value,
    operator:    patch.operator    ?? operator.value,
    value:       patch.value       ?? literal.value,
    aggregation: patch.aggregation ?? aggregation.value,
  }
  // Strip `value` for operators that don't use it — keeps stored shape clean.
  if (!OPERATORS_NEEDING_VALUE.has(next.operator)) delete (next as any).value
  emit('update:modelValue', next)
}

function pickNone() {
  // savedRule keeps the rule details intact — switching back to "Match rule"
  // restores them. We just emit the None mode upstream.
  emit('update:modelValue', { kind: ConditionKind.None })
}

function pickRule() {
  if (kind.value !== ConditionKind.Rule) {
    const r = savedRule.value
    emit('update:modelValue', {
      kind:        ConditionKind.Rule,
      paths:       r.paths,
      operator:    r.operator,
      value:       r.value || undefined,
      aggregation: r.aggregation,
    })
  }
}

// TODO?
function toggleTreePath(path: string) {
  const set = new Set(paths.value)
  if (set.has(path)) set.delete(path)
  else                set.add(path)
  patchRule({ paths: Array.from(set) })
}

function removePath(path: string) {
  patchRule({ paths: paths.value.filter(p => p !== path) })
}

// ── Source-tree picker modal ───────────────────────────────────────────────
// Live mutation: clicks inside the modal toggle paths on the parent state
// directly (via toggleTreePath), so already-watched fields are highlighted
// the moment the modal re-opens. Closing the modal is a no-op for state —
// it's just a UI dismiss.
const isPickerOpen = ref(false)
function openPicker() { isPickerOpen.value = true }
function closePicker() { isPickerOpen.value = false }

// ── Manual "+ type path" input ─────────────────────────────────────────────
const isAdding    = ref(false)
const newPath     = ref('')
const addError    = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

// Typing clears any pending error so the input doesn't look stuck.
watch(newPath, () => { if (addError.value) addError.value = '' })

async function startAdding() {
  isAdding.value = true
  newPath.value  = ''
  addError.value = ''
  await nextTick()
  addInputRef.value?.focus()
}

function commitAdd() {
  const v = newPath.value.trim()
  if (!v) {
    isAdding.value = false
    addError.value = ''
    return
  }
  if (paths.value.includes(v)) {
    // Already on the list — silently dedupe.
    newPath.value  = ''
    addError.value = ''
    return
  }

  // Validate against the retrieved source when we have one. Without a
  // snapshot we can't tell, so we accept the path and let the user fix it
  // later if it doesn't resolve at poll time.
  if (parsed.value !== null) {
    const observed = (function (obj: any, path: string) {
      const parts = path.split('.').filter(Boolean)
      let cur: any = obj
      for (const part of parts) {
        if (cur == null) return undefined
        cur = cur[part]
      }
      return cur
    })(parsed.value, v)

    if (observed === undefined) {
      addError.value = `Path "${v}" doesn't resolve to anything in the retrieved source. Fix it, click ⟳ above to refresh, or press Esc to cancel.`
      return
    }
  }

  patchRule({ paths: [...paths.value, v] })
  newPath.value  = ''
  addError.value = ''
  // Input stays open so the user can paste another variant immediately.
}

function cancelAdd() {
  isAdding.value = false
  newPath.value  = ''
  addError.value = ''
}

// Blur should NOT silently lose the input if an error is on screen — the
// user is mid-fix. Keep the input open until they explicitly act.
function onAddBlur() {
  if (addError.value) return
  cancelAdd()
}

// ── Retrieve (auto on mount + when url/format change) ──────────────────────
const loading = ref(false)
const error   = ref('')
const parsed  = ref<any>(null)
const raw     = ref('')
const retrieved = computed(() => parsed.value !== null)

async function retrieve() {
  const url    = (props.url    ?? '').trim()
  const format = (props.format ?? PollingFormat.XML)
  if (!url) {
    error.value = 'No URL configured. Go back to the input-config step and set one.'
    parsed.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res: any = await $fetch('/api/poll/retrieve', {
      method: 'POST',
      body: { url, format },
    })
    if (!res.ok) {
      error.value  = res.error ?? 'Failed to retrieve'
      parsed.value = null
      raw.value    = res.raw ?? ''
      emit('update:payload', null)
    } else {
      parsed.value = res.parsed
      raw.value    = res.raw ?? ''
      emit('update:payload', res.parsed)
    }
  } catch (e: any) {
    error.value  = e?.data?.statusMessage ?? e?.message ?? 'Network error'
    parsed.value = null
  } finally {
    loading.value = false
  }
}

onMounted(retrieve)
watch(() => [props.url, props.format], retrieve)

// ── Preview (per-path verdicts evaluated on the retrieved snapshot) ────────
function resolvePath(obj: any, path: string): any {
  if (!path) return undefined
  const parts = path.split('.').filter(Boolean)
  let cur: any = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function evalPath(observed: any): { ok: boolean; detail: string } {
  switch (operator.value) {
    case ConditionOperator.Changed:
      return { ok: false, detail: 'change can only be evaluated across consecutive polls' }
    case ConditionOperator.Equals: {
      const ok = String(observed ?? '') === literal.value
      return { ok, detail: ok ? `= "${literal.value}"` : `current "${observed}" ≠ "${literal.value}"` }
    }
    case ConditionOperator.GreaterThan: {
      const a = Number(observed), b = Number(literal.value)
      if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, detail: 'non-numeric' }
      return { ok: a > b, detail: a > b ? `${a} > ${b}` : `${a} ≤ ${b}` }
    }
    case ConditionOperator.LessThan: {
      const a = Number(observed), b = Number(literal.value)
      if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, detail: 'non-numeric' }
      return { ok: a < b, detail: a < b ? `${a} < ${b}` : `${a} ≥ ${b}` }
    }
    case ConditionOperator.Contains: {
      const hay = String(observed ?? '')
      const ok = literal.value.length > 0 && hay.includes(literal.value)
      return { ok, detail: ok ? `contains "${literal.value}"` : `does not contain "${literal.value}"` }
    }
  }
  return { ok: false, detail: '' }
}

const verdicts = computed(() => {
  if (!retrieved.value || paths.value.length === 0) return []
  return paths.value.map((path) => {
    const observed = resolvePath(parsed.value, path)
    const { ok, detail } = evalPath(observed)
    return { path, observed, ok, detail }
  })
})

const verdictSummary = computed(() => {
  if (kind.value === ConditionKind.None) {
    return { ok: true, label: 'Fires every poll cycle (no condition).' }
  }
  if (paths.value.length === 0) {
    return { ok: false, label: 'No fields watched — click values in the source.' }
  }
  if (operator.value === ConditionOperator.Changed) {
    return {
      ok: false,
      label: `Change is detected at poll time (needs a baseline). Watching ${paths.value.length} field${paths.value.length === 1 ? '' : 's'}.`,
    }
  }
  if (needsValue.value && !literal.value) {
    return { ok: false, label: `Operator "${operator.value}" needs a value.` }
  }
  if (!retrieved.value) {
    return { ok: false, label: 'Waiting for source data…' }
  }
  const fired = aggregation.value === ConditionAggregation.All
    ? verdicts.value.every(v => v.ok)
    : verdicts.value.some (v => v.ok)
  const passing = verdicts.value.filter(v => v.ok).length
  const total   = verdicts.value.length
  const word    = aggregation.value === ConditionAggregation.All ? 'all' : 'any'
  return {
    ok:    fired,
    label: fired
      ? `Would fire — ${word} of ${total} field${total === 1 ? '' : 's'} verified (${passing}/${total}).`
      : `Would not fire — ${passing}/${total} field${total === 1 ? '' : 's'} verified, "${word}" requires ${aggregation.value === ConditionAggregation.All ? 'all' : 'at least one'}.`,
  }
})

const rootEntries = computed<Array<[string, any]>>(() => {
  if (!parsed.value) return []
  return Object.entries(parsed.value)
})

// Operators surfaced in the dropdown.
const OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: ConditionOperator.Changed,     label: 'has changed since last poll' },
  { value: ConditionOperator.Equals,      label: 'equals' },
  { value: ConditionOperator.GreaterThan, label: 'is greater than' },
  { value: ConditionOperator.LessThan,    label: 'is less than' },
  { value: ConditionOperator.Contains,    label: 'contains' },
]
</script>

<template>
  <div class="cond-editor">


    <!-- ── Condition (plain panel — no code-block dots) ──────────────────── -->
    <div class="cond-panel">
      <div class="cond-panel-head">Condition</div>
      <div class="cond-panel-body">
      
        <div class="cond-modes">
          <label class="mode" :class="{ active: kind === ConditionKind.None }">
            <input type="radio" :checked="kind === ConditionKind.None" @change="pickNone" />
            <span>Fire every poll cycle</span>
          </label>
          <label class="mode" :class="{ active: kind === ConditionKind.Rule }">
            <input type="radio" :checked="kind === ConditionKind.Rule" @change="pickRule" />
            <span>Match a rule</span>
          </label>
        </div>

        <div v-if="kind === ConditionKind.Rule" class="rule-block">

          <!-- Watched fields — header, action row (anchored, not floating
               with the chips), then the chip list below. Buttons stay in a
               fixed spot so they're discoverable regardless of chip count. -->
          <div class="rule-row">
            <!-- Split header: label + hint on the left, action buttons on the
                 right. Anchors the buttons away from the chips so they don't
                 visually blend with path badges, and keeps them in a fixed
                 spot regardless of chip count. -->
            <div class="watched-head">
              <div class="watched-meta">
                <span class="rule-label">
                  Watched fields
                  <span class="rule-count">({{ paths.length }})</span>
                </span>
                <p class="rule-hint">
                  Type a path like <code>root.production.origin.code</code>, or open the picker to choose visually.
                </p>
              </div>

              <!-- Action buttons stay visible at all times — clicking
                   "Type path" doesn't replace them, it just spawns an inline
                   input next to the existing path chips below. -->
              <div class="watched-actions">
                <button type="button" class="add-btn" :class="{ active: isAdding }" @click="startAdding">
                  <span class="add-icon">✎</span> Type path
                </button>
                <button type="button" class="add-btn" @click="openPicker">
                  <span class="add-icon">⊞</span> Pick from source
                </button>
              </div>
            </div>

            <p v-if="addError" class="add-error">⚠ {{ addError }}</p>

            <!-- Chips row hosts the watched paths AND the typing input when
                 active — the input behaves like a "chip in progress". -->
            <div v-if="paths.length > 0 || isAdding" class="chips">
              <span
                v-for="p in paths"
                :key="p"
                class="chip"
              >
                <span class="chip-path">{{ p }}</span>
                <button type="button" class="chip-x" @click="removePath(p)">×</button>
              </span>

              <span
                v-if="isAdding"
                class="chip-input-wrap"
                :class="{ 'has-error': addError }"
              >
                <input
                  ref="addInputRef"
                  v-model="newPath"
                  type="text"
                  class="chip-input"
                  placeholder="paste or type a path, then Enter"
                  @keydown.enter.prevent="commitAdd"
                  @keydown.escape="cancelAdd"
                  @blur="onAddBlur"
                />
                <button
                  type="button"
                  class="chip-input-done"
                  title="Done"
                  @mousedown.prevent="commitAdd"
                >✓</button>
                <button
                  type="button"
                  class="chip-input-cancel"
                  title="Cancel"
                  @mousedown.prevent="cancelAdd"
                >✕</button>
              </span>
            </div>
            <p v-else class="chips-empty">— no watched fields yet —</p>
          </div>

          <!-- Operator + value + aggregation, on one line when it fits -->
          <div class="rule-row inline">
            <span class="rule-label">Trigger when</span>

            <select
              v-if="paths.length > 1"
              class="rule-select agg"
              :value="aggregation"
              @change="patchRule({ aggregation: ($event.target as HTMLSelectElement).value as ConditionAggregation })"
            >
              <option :value="ConditionAggregation.All">all of them</option>
              <option :value="ConditionAggregation.Any">at least one</option>
            </select>
            <span v-else class="agg-fake">the field</span>

            <select
              class="rule-select op"
              :value="operator"
              @change="patchRule({ operator: ($event.target as HTMLSelectElement).value as ConditionOperator })"
            >
              <option v-for="o in OPERATORS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>

            <input
              v-if="needsValue"
              type="text"
              class="rule-input"
              :value="literal"
              placeholder="value"
              @input="patchRule({ value: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

      </div>
    </div>

    <!-- ── Source picker modal ─────────────────────────────────────────────
         Opens via "⊞ pick from source". Clicks on leaf values toggle the
         path on the parent state immediately (live mutation), so on next
         open already-watched fields are still highlighted in green. Closing
         the modal is just a UI dismiss. -->
    <div v-if="isPickerOpen" class="overlay" @click.self="closePicker">
      <div class="overlay-box picker-modal" @click.stop>
        <div class="picker-head">
          <h4>Pick watched fields from source</h4>
          <button type="button" class="picker-close" title="Close" @click="closePicker">✕</button>
        </div>

        <div class="picker-body">
          <div class="code-block source-block">
            <div class="code-header">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
              <span class="code-title">source.{{ (format ?? 'xml').toLowerCase() }}</span>
              <span class="code-url" :title="props.url">{{ props.url }}</span>
              <button
                type="button"
                class="btn-refresh"
                :disabled="loading"
                title="Re-fetch the source"
                @click="retrieve"
              >
                {{ loading ? '…' : '⟳' }}
              </button>
            </div>
            <div class="code-body tree-body">
              <div v-if="loading" class="muted">Fetching {{ props.url }}…</div>

              <div v-else-if="error" class="source-error">
                <div class="error-head">⚠ Could not retrieve source</div>
                <pre class="error-body">{{ error }}</pre>
                <p class="error-hint">
                  Check the URL in the input-config step, then click ⟳ above to retry.
                </p>
              </div>

              <div v-else-if="!retrieved" class="muted">Waiting for source data…</div>
              <div v-else-if="rootEntries.length === 0" class="muted">Empty document.</div>

              <template v-else>
                <p class="tree-hint">
                  Click any value to toggle it as a watched field. Already-selected
                  paths show with a green outline — click again to remove.
                </p>
                <XmlTreeNode
                  v-for="([k, v]) in rootEntries"
                  :key="k"
                  :node-name="k"
                  :node-value="v"
                  :path="k"
                  :selected="paths"
                  @select="toggleTreePath"
                />
              </template>
            </div>
          </div>
        </div>

        <div class="picker-foot">
          <span class="picker-count">{{ paths.length }} field{{ paths.length === 1 ? '' : 's' }} selected</span>
          <ButtonPrimary @click="closePicker">Done</ButtonPrimary>
        </div>
      </div>
    </div>


    <!-- ── Preview (compact status strip — no code-block dots) ───────────── -->
    <div
      class="preview-strip"
      :class="verdictSummary.ok ? 'ok' : 'no'"
    >
      <span class="bullet">●</span>
      <span class="preview-label">{{ verdictSummary.label }}</span>

      <details v-if="kind === ConditionKind.Rule && verdicts.length > 0" class="preview-detail">
        <summary>per-field breakdown</summary>
        <ul>
          <li v-for="v in verdicts" :key="v.path" :class="v.ok ? 'ok' : 'no'">
            <code>{{ v.path }}</code> — {{ v.detail }}
          </li>
        </ul>
      </details>
    </div>

  </div>
</template>

<style scoped>


/* The Mac-style code-block frame (.code-block / .code-header / .dot / etc.)
 * comes from the global stylesheet. Everything here is condition-editor
 * specific: the URL strip in the header, the refresh button, the source
 * error box, the condition rule panel, the chips/inputs for paths, and
 * the preview strip.
 */

.cond-editor { display: flex; flex-direction: column; gap: var(--space-4); }

/* ── Source code-block header extras ────────────────────────────────── */
.code-url {
  margin-left: var(--space-3);
  flex: 1;
  min-width: 0;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-refresh {
  background: transparent;
  border: 1px solid #444;
  color: #a3a3a3;
  width: 26px; height: 22px;
  border-radius: var(--radius-sm);
  font-size: var(--text-lg); line-height: 1;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
  flex-shrink: 0;
}
.btn-refresh:hover:not(:disabled) {
  background: var(--color-bg-code-header);
  color: var(--color-text-primary);
  border-color: #666;
}
.btn-refresh:disabled { opacity: 0.4; cursor: wait; }

/* ── Source body callouts ──────────────────────────────────────────── */
.tree-body { background: var(--color-bg-code); }
.muted { color: var(--color-text-dim); font-size: var(--text-md); line-height: 1.5; }
.muted strong { color: var(--color-accent-text); }

.tree-hint {
  margin: 0 0 var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: #0a0a0a;
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-accent-text);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.source-error {
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-lg);
  color: var(--color-danger-bright);
}
.error-head { font-weight: 700; font-size: var(--text-base); color: var(--color-danger-text); }
.error-body {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: #0a0a0a;
  border-radius: var(--radius-sm);
  color: var(--color-danger-bright);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.error-hint { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }

/* ── Condition panel (renamed from .panel to avoid clashing with the
 *    global wizard/editor shell). ───────────────────────────────────── */
.cond-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.cond-panel-head {
  padding: var(--space-3) var(--space-5);
  background: var(--color-bg-card-soft);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.cond-panel-body {
  padding: var(--space-5);
  display: flex; flex-direction: column;
  gap: var(--space-5);
}

/* Mode radios (None / Rule). */
.cond-modes { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.mode {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 7px var(--space-4);
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
}
.mode:hover { border-color: var(--color-border-strong); }
.mode.active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-text-primary);
}
.mode input[type='radio'] { accent-color: var(--color-accent); cursor: pointer; }

/* Rule block */
.rule-block { display: flex; flex-direction: column; gap: var(--space-3); }
.rule-row { display: flex; flex-direction: column; gap: var(--space-2); }
.rule-row.inline { flex-direction: row; align-items: center; flex-wrap: wrap; }
.rule-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.rule-count { color: var(--color-text-faint); font-weight: 500; margin-left: var(--space-1); }
.rule-row.inline .rule-label { margin-right: var(--space-1); }

.rule-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-md);
  line-height: 1.5;
}
.rule-hint code {
  color: var(--color-accent-text);
  background: var(--color-border-subtle); /* theme-aware: dark slate / light gray */
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.rule-hint strong { color: var(--color-text-secondary); font-weight: 600; }

/* Split header for the Watched-fields row: label + hint on the left, the
 * two add buttons on the right. Wraps on narrow viewports so the buttons
 * drop below instead of squashing the input/hint. */
.watched-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.watched-meta {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.watched-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  flex-shrink: 0;
}
/* Solid-accent buttons — visually distinct from the soft-accent chips so
 * "add an entry" is unmistakeable next to "an entry that exists". Filled
 * surface + on-accent text reads as a CTA in both themes. */
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-text-on-accent);
  padding: 6px var(--space-4);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: background-color .15s, border-color .15s, transform .05s, box-shadow .15s;
}
.add-btn:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.add-btn:active { transform: translateY(1px); box-shadow: none; }
/* Pressed-in look while the inline input is open — signals "this button is
 * the one driving the input that just appeared in the chips row below". */
.add-btn.active {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}
.add-icon { font-size: var(--text-base); line-height: 1; }

.chips-empty {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-md);
  font-style: italic;
}

/* Watched-path chips. Use the global .chip / .chip-add base + scoped
 * tweaks for the path-flavored display (asymmetric padding to make room
 * for the × button). */
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.chip { padding: 3px var(--space-1) 3px var(--space-3); }
.chip-path { white-space: nowrap; }
.chip-x {
  background: transparent;
  border: none;
  color: var(--color-accent-text);
  font-size: var(--text-lg);
  line-height: 1;
  padding: 0 var(--space-1);
  cursor: pointer;
}
.chip-x:hover { color: var(--color-text-on-accent); }
.chips-hint { color: var(--color-text-faint); font-size: var(--text-md); font-style: italic; }

/* + add path — manual entry that morphs into an inline input. */
.chip-add {
  font-family: var(--font-mono);
  padding: 3px var(--space-4);
}

.chip-input-wrap {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-input);
}
.chip-input-wrap.has-error {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
}
.chip-input {
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 3px var(--space-3);
  min-width: 260px;
}
.chip-input:focus { outline: none; }
.chip-input::placeholder { color: var(--color-text-faint); }

.chip-input-done {
  background: #1e3a8a;
  border: none;
  border-left: 1px solid var(--color-accent);
  color: var(--color-text-on-accent);
  font-size: var(--text-md);
  padding: 0 var(--space-3);
  cursor: pointer;
}
.chip-input-done:hover { background: var(--color-accent); }
.chip-input-wrap.has-error .chip-input-done {
  background: var(--color-danger-border);
  border-left-color: var(--color-danger-strong);
}
.chip-input-wrap.has-error .chip-input-done:hover { background: #991b1b; }

.chip-input-cancel {
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-danger-border);
  color: var(--color-danger-text);
  font-size: var(--text-lg);
  padding: 0 var(--space-3);
  cursor: pointer;
}
.chip-input-cancel:hover { color: var(--color-text-on-accent); background: var(--color-danger-border); }

.add-error {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) var(--space-4);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
  color: var(--color-danger-bright);
  font-size: var(--text-sm);
  line-height: 1.5;
}

/* Operator / value / aggregation inputs. */
.rule-select,
.rule-input {
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-md);
}
.rule-select { cursor: pointer; }
.rule-select:focus,
.rule-input:focus { outline: none; border-color: var(--color-accent); }
.rule-select.agg { min-width: 110px; }
.rule-select.op  { min-width: 200px; flex: 1 1 auto; }
.rule-input      { min-width: 120px; flex: 1 1 120px; }
.agg-fake { color: var(--color-text-dim); font-size: var(--text-md); }

/* ── Preview strip ──────────────────────────────────────────────────── */
.preview-strip {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid;
  font-size: var(--text-md);
}
.preview-strip.ok {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
  color: var(--color-success-bright);
}
.preview-strip.no {
  background: var(--color-bg-card-soft);
  border-color: var(--color-border-default);
  color: var(--color-text-secondary);
}
.preview-strip .bullet { font-size: var(--text-xl); line-height: 1; }
.preview-strip.ok .bullet { color: var(--color-success); }
.preview-strip.no .bullet { color: var(--color-text-dim); }
.preview-label { flex: 1; min-width: 0; }

.preview-detail { margin-left: auto; color: var(--color-text-muted); font-size: var(--text-sm); max-width: 100%; }
.preview-detail summary { cursor: pointer; user-select: none; }
.preview-detail summary:hover { color: var(--color-accent-text); }
.preview-detail ul {
  margin: var(--space-2) 0 0;
  padding: var(--space-3) var(--space-4);
  list-style: none;
  background: var(--color-bg-input); /* deeper than the strip, theme-aware */
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  display: flex; flex-direction: column; gap: var(--space-1);
  max-height: 200px;
  overflow-y: auto;
}
.preview-detail li { font-family: var(--font-mono); font-size: var(--text-sm); }
.preview-detail li.ok { color: var(--color-success-bright); }
.preview-detail li.no { color: var(--color-text-secondary); }
.preview-detail code {
  color: var(--color-accent-text);
  background: var(--color-border-subtle); /* theme-aware so accent-text stays legible */
  padding: 1px 4px;
  border-radius: 3px;
}
/* Per-field breakdown text colors — dim defaults are too pale on the new
 * light-mode preview surface, so use the regular text tokens. */
.preview-detail li.ok { color: var(--color-success); }
.preview-detail li.no { color: var(--color-text-secondary); }

/* ── Source picker modal ──────────────────────────────────────────────
 * Overrides the small overlay-box default (max-width: 360px, padded
 * everywhere) so the modal can host the full XML tree comfortably and
 * scroll internally instead of pushing the whole page. */
.picker-modal {
  width: 90vw;
  max-width: 760px;
  max-height: 85vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.picker-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}
.picker-head h4 {
  margin: 0;
  flex: 1;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
}
.picker-close {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: var(--text-lg);
  line-height: 1;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}
.picker-close:hover { color: var(--color-text-primary); background: var(--color-border-subtle); }

.picker-body {
  flex: 1;
  min-height: 0;
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
}
/* The code-block inside the picker should fill the body and let its own
 * code-body scroll — keeps the modal as a single scrollable region. */
.picker-body .code-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.picker-body .code-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.picker-foot {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
}
.picker-count {
  flex: 1;
  font-size: var(--text-md);
  color: var(--color-text-muted);
}
</style>
