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
import { expandPath, hasWildcard } from '#shared/pathExpand'
import { evaluateCondition } from '#shared/conditionEval'
import ButtonPrimary from '../ui/ButtonPrimary.vue';

const { t } = useI18n()

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
// Shortcut to condition parameters
const kind = computed(() => current.value.kind)
const paths       = computed(() => current.value.paths)
const operator    = computed(() => current.value.operator)
const literal     = computed(() => current.value.value ?? '')
const aggregation = computed(() => current.value.aggregation)
// Determine if the condition needs an external value to evaluate 
const needsValue = computed(() => OPERATORS_NEEDING_VALUE.has(operator.value))

// `paths`         = what the user typed (chips). May contain wildcards. This is what is visible in "watched fields" panel
// `effectivePaths` = the concrete set tose previous chips resolve to in the current snapshot and system.
//                     all effective Paths are internally displayed na evaluated at poll time
const effectivePaths = computed<string[]>(() => {
  if (!parsed.value) {
    return [...new Set(paths.value.filter(p => !hasWildcard(p)))]
  }
  const set = new Set<string>()
  for (const p of paths.value) {
    if (hasWildcard(p)) {
      for (const c of expandPath(p, parsed.value)) set.add(c)
    } else {
      set.add(p)
    }
  }
  return [...set]
})



// Emit a new condition, merging only the changed bits onto the current
// shape. We KEEP `value` even when the operator doesn't use it; compaction at save time
// drops it. Same for all other fields when kind is None.
function patchRule(patch: Partial<PollingCondition>) {
  emit('update:modelValue', {
    ...current.value,
    ...patch,
    kind: ConditionKind.Rule, // is this line necessary?? TODO
  })
}

// Flip kind only. The other fields are preserved in-place so the user
// doesn't lose their selections when toggling None ⇄ Rule. The DB-save
// path (`compactCondition`) strips them if kind ends up None.
function pickNone() {
  emit('update:modelValue', { ...current.value, kind: ConditionKind.None })
}

function pickRule() {
  if (kind.value !== ConditionKind.Rule) {
    emit('update:modelValue', { ...current.value, kind: ConditionKind.Rule })
  }
}

// Picker clicks. Three cases:
function toggleTreePath(path: string) {
  //  (a) The clicked leaf is already a concrete chip → remove it.
  if (paths.value.includes(path)) {  
    patchRule({ paths: paths.value.filter(p => p !== path) })
    return
  }
  //  (b) Not a chip but covered by a wildcard chip → silent no-op. Removing
  //  the leaf would have to remove the wildcard (too destructive), so
  //  we leave it green and direct the user to the chips list instead.
  if (effectivePaths.value.includes(path)) return // covered by a wildcard
  //   (c) Not on the list at all → add as a concrete chip.
  patchRule({ paths: [...paths.value, path] })
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

  const wildcard = hasWildcard(v)

  // Validate against the retrieved snapshot when available — both concrete
  // paths and wildcards must point to *something* there. Without a snapshot
  // we accept anyway; the evaluator will sort it out at poll time.
  //
  // Wildcards are STORED VERBATIM (not expanded into many chips). The
  // server-side evaluator re-expands them on every poll, so a pattern like
  // `..temperatura.maxima` automatically picks up new array entries.
  if (parsed.value !== null) {
    const expanded = expandPath(v, parsed.value)
    if (expanded.length === 0) {
      addError.value = wildcard
        ? t('conditionEditor.validation.patternNoMatch', { value: v })
        : t('conditionEditor.validation.pathNotInSource', { value: v })
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
    error.value = t('conditionEditor.errors.noUrl')
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
      error.value  = res.error ?? t('conditionEditor.errors.failedToRetrieve')
      parsed.value = null
      raw.value    = res.raw ?? ''
      emit('update:payload', null)
    } else {
      parsed.value = res.parsed
      raw.value    = res.raw ?? ''
      emit('update:payload', res.parsed)
    }
  } catch (e: any) {
    error.value  = e?.data?.statusMessage ?? e?.message ?? t('conditionEditor.errors.networkError')
    parsed.value = null
  } finally {
    loading.value = false
  }
}

onMounted(retrieve)
watch(() => [props.url, props.format], retrieve)

// ── Preview (per-path verdicts evaluated on the retrieved snapshot) ────────
// All evaluation logic lives in `#shared/conditionEval` — used identically
// by the server engine, the polling-default message builder, and this
// preview. No baseline is available client-side, so `Changed` operators
// show as "would fire on next change" (the evaluator's preview default).
const verdicts = computed(() => {
  if (!retrieved.value || paths.value.length === 0) return []
  return evaluateCondition(current.value, parsed.value).verdicts
})

const verdictSummary = computed(() => {
  if (kind.value === ConditionKind.None) {
    return { ok: true, label: t('conditionEditor.summary.firesEvery') }
  }
  if (paths.value.length === 0) {
    return { ok: false, label: t('conditionEditor.summary.noFields') }
  }
  // Chips exist but resolve to nothing (typical case: wildcard pattern that
  // doesn't match anything in the current source). Surface this distinctly
  // from "no chips at all" so the user knows the alert needs a fix.
  if (retrieved.value && effectivePaths.value.length === 0) {
    return { ok: false, label: t('conditionEditor.summary.noMatch') }
  }
  if (operator.value === ConditionOperator.Changed) {
    const n = effectivePaths.value.length
    return {
      ok: false,
      label: n === 1
        ? t('conditionEditor.summary.changedNeedsBaseline', { n })
        : t('conditionEditor.summary.changedNeedsBaselinePlural', { n }),
    }
  }
  if (needsValue.value && !literal.value) {
    return { ok: false, label: t('conditionEditor.summary.operatorNeedsValue', { operator: operator.value }) }
  }
  if (!retrieved.value) {
    return { ok: false, label: t('conditionEditor.summary.waitingForSource') }
  }
  const fired = aggregation.value === ConditionAggregation.All
    ? verdicts.value.every(v => v.fired)
    : verdicts.value.some (v => v.fired)
  const passing = verdicts.value.filter(v => v.fired).length
  const total   = verdicts.value.length
  const isAll   = aggregation.value === ConditionAggregation.All
  // Pick the right plural variant based on the total count; the "all/any"
  // axis splits each plural pair so we end up with 8 distinct keys.
  const key = fired
    ? (isAll
        ? (total === 1 ? 'conditionEditor.summary.wouldFireAll'     : 'conditionEditor.summary.wouldFireAllPlural')
        : (total === 1 ? 'conditionEditor.summary.wouldFireAny'     : 'conditionEditor.summary.wouldFireAnyPlural'))
    : (isAll
        ? (total === 1 ? 'conditionEditor.summary.wouldNotFireRequiresAll' : 'conditionEditor.summary.wouldNotFireRequiresAllPlural')
        : (total === 1 ? 'conditionEditor.summary.wouldNotFireRequiresAny' : 'conditionEditor.summary.wouldNotFireRequiresAnyPlural'))
  return { ok: fired, label: t(key, { total, passing }) }
})

const rootEntries = computed<Array<[string, any]>>(() => {
  if (!parsed.value) return []
  return Object.entries(parsed.value)
})

// Operators surfaced in the dropdown. Labels are resolved at render time so
// they re-translate when the locale changes — `computed` keeps reactivity.
const OPERATORS = computed<Array<{ value: ConditionOperator; label: string }>>(() => [
  { value: ConditionOperator.Changed,     label: t('conditionEditor.operator.changed')     },
  { value: ConditionOperator.Equals,      label: t('conditionEditor.operator.equals')      },
  { value: ConditionOperator.GreaterThan, label: t('conditionEditor.operator.greaterThan') },
  { value: ConditionOperator.LessThan,    label: t('conditionEditor.operator.lessThan')    },
  { value: ConditionOperator.Contains,    label: t('conditionEditor.operator.contains')    },
])
</script>

<template>
  <div class="cond-editor">


    <!-- ── Condition (plain panel — no code-block dots) ──────────────────── -->
    <div class="cond-panel">
      <div class="cond-panel-head">{{ $t('conditionEditor.panel.title') }}</div>
      <div class="cond-panel-body">

        <div class="cond-modes">
          <label class="mode" :class="{ active: kind === ConditionKind.None }">
            <input type="radio" :checked="kind === ConditionKind.None" @change="pickNone" />
            <span>{{ $t('conditionEditor.mode.none') }}</span>
          </label>
          <label class="mode" :class="{ active: kind === ConditionKind.Rule }">
            <input type="radio" :checked="kind === ConditionKind.Rule" @change="pickRule" />
            <span>{{ $t('conditionEditor.mode.rule') }}</span>
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
                  {{ $t('conditionEditor.watchedFields.label') }}
                 
                  <span class="rule-count">({{ effectivePaths.length }})</span>
                </span>
                <!-- The hint embeds two code-styled snippets. Translation
                     placeholders ({dotdot}/{example}) become i18n-t children
                     so the strings stay translatable in one piece. -->
                <p class="rule-hint">
                  <i18n-t keypath="conditionEditor.watchedFields.hint" tag="span">
                    <template #dotdot><code>{{ $t('conditionEditor.watchedFields.hintCode') }}</code></template>
                    <template #example><code>{{ $t('conditionEditor.watchedFields.hintExample') }}</code></template>
                  </i18n-t>
                </p>
              </div>

              <!-- Action buttons stay visible at all times — clicking
                   "Type path" doesn't replace them, it just spawns an inline
                   input next to the existing path chips below. -->
              <div class="watched-actions">
                <ButtonPrimary small @click="startAdding">
                  <span class="add-icon">✎</span> {{ $t('conditionEditor.watchedFields.typePath') }}
                </ButtonPrimary>

                <ButtonPrimary small @click="openPicker">
                  <span class="add-icon">⊞</span> {{ $t('conditionEditor.watchedFields.pickFromSource') }}
                </ButtonPrimary>
                
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
                  :placeholder="$t('conditionEditor.watchedFields.inputPlaceholder')"
                  @keydown.enter.prevent="commitAdd"
                  @keydown.escape="cancelAdd"
                />
                <button
                  type="button"
                  class="chip-input-done"
                  :title="$t('conditionEditor.watchedFields.inputDone')"
                  @click="commitAdd"
                >✓</button>
                <button
                  type="button"
                  class="chip-input-cancel"
                  :title="$t('conditionEditor.watchedFields.inputCancel')"
                  @click="cancelAdd"
                >✕</button>
              </span>
            </div>
            <p v-else class="chips-empty">{{ $t('conditionEditor.watchedFields.emptyChips') }}</p>
          </div>

          <!-- Operator + value + aggregation, on one line when it fits -->
          <div class="rule-row inline">
            <span class="rule-label">{{ $t('conditionEditor.trigger.label') }}</span>

            <!-- Always shown: a single chip can be a wildcard pattern that
                 resolves to many paths at poll time, so aggregation matters
                 even with one chip on the list. -->
            <select
              class="rule-select agg"
              :value="aggregation"
              @change="patchRule({ aggregation: ($event.target as HTMLSelectElement).value as ConditionAggregation })"
            >
              <option :value="ConditionAggregation.All">{{ $t('conditionEditor.aggregation.all') }}</option>
              <option :value="ConditionAggregation.Any">{{ $t('conditionEditor.aggregation.any') }}</option>
            </select>

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
              :placeholder="$t('conditionEditor.value.placeholder')"
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
      <div class="overlay-box picker-modal">
        <div class="picker-head">
          <h4>{{ $t('conditionEditor.picker.title') }}</h4>
          <button type="button" class="picker-close" :title="$t('conditionEditor.picker.closeTitle')" @click="closePicker">✕</button>
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
                :title="$t('conditionEditor.picker.refreshTitle')"
                @click="retrieve"
              >
                {{ loading ? '…' : '⟳' }}
              </button>
            </div>
            <div class="code-body tree-body">
              <div v-if="loading" class="muted">{{ $t('conditionEditor.picker.fetching', { url: props.url }) }}</div>

              <div v-else-if="error" class="source-error">
                <div class="error-head">{{ $t('conditionEditor.errors.couldNotRetrieveTitle') }}</div>
                <pre class="error-body">{{ error }}</pre>
                <p class="error-hint">
                  {{ $t('conditionEditor.errors.couldNotRetrieveHint') }}
                </p>
              </div>

              <div v-else-if="!retrieved" class="muted">{{ $t('conditionEditor.picker.waiting') }}</div>
              <div v-else-if="rootEntries.length === 0" class="muted">{{ $t('conditionEditor.picker.empty') }}</div>

              <template v-else>

                <XmlTreeNode
                  v-for="([k, v]) in rootEntries"
                  :key="k"
                  :node-name="k"
                  :node-value="v"
                  :path="k"
                  :selected="effectivePaths"
                  @select="toggleTreePath"
                />
              </template>
            </div>
          </div>
        </div>

        <div class="picker-foot">
          <span class="picker-count">
            {{ effectivePaths.length === 1
              ? $t('conditionEditor.picker.fieldsSelected',       { n: effectivePaths.length })
              : $t('conditionEditor.picker.fieldsSelectedPlural', { n: effectivePaths.length }) }}
          </span>
          <ButtonPrimary @click="closePicker">{{ $t('conditionEditor.picker.doneButton') }}</ButtonPrimary>
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
        <summary>{{ $t('editor.testModal.perFieldBreakdown') }}</summary>
        <ul>
          <li v-for="v in verdicts" :key="v.path" :class="v.fired ? 'ok' : 'no'">
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
