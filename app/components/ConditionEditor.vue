<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import XmlTreeNode from './XmlTreeNode.vue'
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

function toggleTreePath(path: string) {
  const set = new Set(paths.value)
  if (set.has(path)) set.delete(path)
  else                set.add(path)
  patchRule({ paths: Array.from(set) })
}

function removePath(path: string) {
  patchRule({ paths: paths.value.filter(p => p !== path) })
}

// ── Manual "+ add path" input ───────────────────────────────────────────────
const isAdding = ref(false)
const newPath  = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

async function startAdding() {
  isAdding.value = true
  newPath.value  = ''
  await nextTick()
  addInputRef.value?.focus()
}

function commitAdd() {
  const v = newPath.value.trim()
  if (!v) {
    isAdding.value = false
    return
  }
  if (!paths.value.includes(v)) {
    patchRule({ paths: [...paths.value, v] })
  }
  newPath.value = ''
  // Keep the input open so the user can paste another variant immediately.
}

function cancelAdd() {
  isAdding.value = false
  newPath.value  = ''
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
    <div class="panel cond-panel">
      <div class="panel-head">Condition</div>
      <div class="panel-body">

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

          <!-- Watched fields (chips) -->
          <div class="rule-row">
            <span class="rule-label">
              Watched fields
              <span class="rule-count">({{ paths.length }})</span>
            </span>
            <p class="rule-hint">
              Add by clicking values in the source tree above, or paste a path
              by hand with the <strong>+ add path</strong> button — handy to
              build variants like <code>dia.0</code>, <code>dia.1</code>,
              <code>dia.2</code>.
            </p>
            <div class="chips">
              <span
                v-for="p in paths"
                :key="p"
                class="chip"
              >
                <span class="chip-path">{{ p }}</span>
                <button type="button" class="chip-x" @click="removePath(p)">×</button>
              </span>

              <!-- Manual entry: + add path / input -->
              <button
                v-if="!isAdding"
                type="button"
                class="chip-add"
                @click="startAdding"
              >+ add path</button>
              <span v-else class="chip-input-wrap">
                <input
                  ref="addInputRef"
                  v-model="newPath"
                  type="text"
                  class="chip-input"
                  placeholder="paste or type a path, then Enter"
                  @keydown.enter.prevent="commitAdd"
                  @keydown.escape="cancelAdd"
                  @blur="cancelAdd"
                />
                <button
                  type="button"
                  class="chip-input-done"
                  title="Done"
                  @mousedown.prevent="commitAdd"
                >✓</button>
              </span>

              <span v-if="paths.length === 0 && !isAdding" class="chips-hint">
                — none yet —
              </span>
            </div>
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

        <!-- ── Source XML (the only code-block) ──────────────────────────────── -->
    <div class="code-block source-block">
      <div class="code-header">
        <span class="dot red" /><span class="dot yellow" /><span class="dot green" />
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

        <p
          v-else-if="kind === ConditionKind.Rule"
          class="tree-hint"
        >
          Click any value below to add it to the watched fields. Click again to
          remove. Selected paths show with a green outline.
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
.cond-editor { display: flex; flex-direction: column; gap: 12px; }

/* ── Source (code-block) ────────────────────────────────────────────── */
.code-block {
  background: #1e1e1e;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 320px;
  max-height: 520px;
}
.code-header {
  background: #2d2d2d;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #1e1e1e;
  flex-shrink: 0;
}
.dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }
.code-title { color: #a3a3a3; font-size: 12px; font-family: ui-monospace, monospace; margin-left: 8px; }
.code-url {
  margin-left: 8px;
  flex: 1;
  min-width: 0;
  color: #6b7280;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-refresh {
  background: transparent;
  border: 1px solid #444;
  color: #a3a3a3;
  width: 26px; height: 22px;
  border-radius: 4px;
  font-size: 14px; line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.btn-refresh:hover:not(:disabled) { background: #2d2d2d; color: #f1f5f9; border-color: #666; }
.btn-refresh:disabled { opacity: 0.4; cursor: wait; }

.code-body { padding: 12px; overflow-y: auto; flex: 1; color: #d4d4d4; }
.tree-body { background: #1e1e1e; }
.muted { color: #6b7280; font-size: 12px; line-height: 1.5; }
.muted strong { color: #93c5fd; }

.tree-hint {
  margin: 0 0 10px;
  padding: 8px 10px;
  background: #0a0a0a;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  color: #93c5fd;
  font-size: 11px;
  line-height: 1.5;
}

/* Inline source error */
.source-error {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px;
  background: #1a0a0a;
  border: 1px solid #7f1d1d;
  border-radius: 6px;
  color: #fecaca;
}
.error-head { font-weight: 700; font-size: 13px; color: #fca5a5; }
.error-body {
  margin: 0;
  padding: 8px 10px;
  background: #0a0a0a;
  border-radius: 4px;
  color: #fecaca;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.error-hint { margin: 0; color: #94a3b8; font-size: 11px; }

/* ── Plain panels (condition / preview) ─────────────────────────────── */
.panel {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
}
.panel-head {
  padding: 8px 14px;
  background: #131a24;
  border-bottom: 1px solid #1e293b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #94a3b8;
}
.panel-body { padding: 14px; display: flex; flex-direction: column; gap: 14px; }

/* Mode radios — same row */
.cond-modes { display: flex; gap: 10px; flex-wrap: wrap; }
.mode {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s;
}
.mode:hover { border-color: #475569; }
.mode.active { background: #0f2744; border-color: #1e40af; color: #f1f5f9; }
.mode input[type='radio'] { accent-color: #3b82f6; cursor: pointer; }

/* Rule block */
.rule-block { display: flex; flex-direction: column; gap: 10px; }
.rule-row { display: flex; flex-direction: column; gap: 6px; }
.rule-row.inline {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.rule-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #64748b;
}
.rule-count { color: #475569; font-weight: 500; margin-left: 4px; }
.rule-row.inline .rule-label { margin-right: 4px; }

.rule-hint {
  margin: 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}
.rule-hint code {
  color: #93c5fd;
  background: #0a0a0a;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
}
.rule-hint strong { color: #cbd5e1; font-weight: 600; }

/* Chips */
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #0f2744;
  border: 1px solid #1e40af;
  color: #93c5fd;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  padding: 3px 4px 3px 8px;
  border-radius: 4px;
}
.chip-path { white-space: nowrap; }
.chip-x {
  background: transparent;
  border: none;
  color: #93c5fd;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}
.chip-x:hover { color: #fff; }
.chips-hint { color: #475569; font-size: 12px; font-style: italic; }

/* + add path */
.chip-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px dashed #334155;
  color: #94a3b8;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.chip-add:hover { border-color: #3b82f6; color: #93c5fd; background: #0f2744; }

.chip-input-wrap {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  overflow: hidden;
  background: #090d16;
}
.chip-input {
  background: transparent;
  border: none;
  color: #f1f5f9;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  padding: 3px 8px;
  min-width: 260px;
}
.chip-input:focus { outline: none; }
.chip-input::placeholder { color: #475569; }
.chip-input-done {
  background: #1e3a8a;
  border: none;
  border-left: 1px solid #3b82f6;
  color: #fff;
  font-size: 12px;
  padding: 0 8px;
  cursor: pointer;
}
.chip-input-done:hover { background: #2563eb; }

/* Inputs / selects */
.rule-select,
.rule-input {
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid #1e293b;
  border-radius: 5px;
  padding: 6px 10px;
  font-size: 12px;
}
.rule-select { cursor: pointer; }
.rule-select:focus,
.rule-input:focus { outline: none; border-color: #3b82f6; }
.rule-select.agg { min-width: 110px; }
.rule-select.op  { min-width: 200px; flex: 1 1 auto; }
.rule-input      { min-width: 120px; flex: 1 1 120px; }
.agg-fake { color: #64748b; font-size: 12px; }

/* ── Preview strip ──────────────────────────────────────────────────── */
.preview-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 12px;
}
.preview-strip.ok { background: #06270f; border-color: #166534; color: #bbf7d0; }
.preview-strip.no { background: #1a1a1a; border-color: #334155; color: #cbd5e1; }
.preview-strip .bullet { font-size: 16px; line-height: 1; }
.preview-strip.ok .bullet { color: #22c55e; }
.preview-strip.no .bullet { color: #64748b; }
.preview-label { flex: 1; min-width: 0; }

.preview-detail { margin-left: auto; color: #94a3b8; font-size: 11px; max-width: 100%; }
.preview-detail summary { cursor: pointer; user-select: none; }
.preview-detail summary:hover { color: #93c5fd; }
.preview-detail ul {
  margin: 6px 0 0;
  padding: 8px 12px;
  list-style: none;
  background: #0a0a0a;
  border-radius: 4px;
  display: flex; flex-direction: column; gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.preview-detail li { font-family: ui-monospace, monospace; font-size: 11px; }
.preview-detail li.ok { color: #bbf7d0; }
.preview-detail li.no { color: #cbd5e1; }
.preview-detail code { color: #93c5fd; background: #1e1e1e; padding: 1px 4px; border-radius: 3px; }
</style>
