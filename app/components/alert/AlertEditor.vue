<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Formatting,
  AlertStatus,
  Trigger,
  ConditionKind,
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  migrateCondition,
  isPollingSource,
  type DiscussionModel,
  type BundleModel,
  type AlertModel,
} from '#shared/constants'
import { alertService } from '~/utils/alertService'
import { pollingService } from '~/utils/pollingService'

// AlertEditor is now PURE VIEW MODE. Edits go through the wizard
// (`/alerts/[id]?edit=1`) or — for a single bundle — through the in-place
// edit modal at the bottom of this component. No inline form, no route
// guard, no dirty tracking required here.

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
}>(), {
  alertaInicial: null,
})

const { alerts, availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts()

const confirmingDelete = ref(false)

const blankForm = (): AlertModel => ({
  id: null,
  title: '',
  description: '',
  input: '',
  triggerType: '',
  status: AlertStatus.Draft,
  token: '',
  triggerParams: {},
  bundles: [],
})

const form = ref<AlertModel>(blankForm())

const resolveDiscussions = (ids: any[]): DiscussionModel[] =>
  (ids || []).map((entry: any) => {
    const id = String(typeof entry === 'object' ? entry.id : entry)
    const discussions = availableDiscussions?.value ?? []
    return discussions.find(d => d.id === id) ?? { id, title: `#${id}` }
  })

const fillFrom = (a: AlertModel | null) => {
  if (a && a.id) {
    form.value = {
      id: a.id,
      title: a.title || '',
      description: a.description || '',
      input: a.input || '',
      triggerType: a.triggerType || '',
      status: a.status || AlertStatus.Draft,
      token: a.token || '',
      triggerParams: (a.triggerParams as Record<string, any>) ?? {},
      bundles: (a.bundles || []).map(b => ({
        id: b.id,
        name: b.name,
        formating: (b.formating as Formatting) || Formatting.Unformatted,
        custom_script: b.custom_script || '',
        discussion_list: resolveDiscussions(b.discussion_list as any),
      })),
    }
  } else {
    form.value = blankForm()
  }
}

watch(() => props.alertaInicial, (a) => {
  fillFrom(a)
  confirmingDelete.value = false
}, { immediate: true })

// Re-resolve discussion titles once the discussion list finishes loading.
watch(availableDiscussions, (available) => {
  if (available.length === 0) return
  form.value.bundles = form.value.bundles.map(b => ({
    ...b,
    discussion_list: resolveDiscussions(b.discussion_list),
  }))
})

// ── Derived state ──────────────────────────────────────────────────────────
const isExisting  = computed(() => form.value.id !== null)
const canActivate = computed(() => form.value.bundles.length > 0)
const isPolling   = computed(() => isPollingSource(form.value.input))

const webhookUrl = computed(() => {
  if (!form.value.token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/webhooks/${form.value.token}`
})

// Human-readable label for a Formatting enum value — used in the compact
// bundle rows in view mode.
// TODO move somewhere else
const formatLabel = (f: Formatting): string => {
  switch (f) {
    case Formatting.Unformatted:    return 'Brute (raw JSON)'
    case Formatting.Simple:         return 'Simple (title + description)'
    case Formatting.Custom:         return 'Custom script (Handlebars)'
    case Formatting.PollingDefault: return 'Default (watched fields)'
    case Formatting.PollingCustom:  return 'Custom script (Handlebars)'
    default:                        return String(f)
  }
}

// ── Polling trigger-detail labels ──────────────────────────────────────────
const intervalLabel = computed(() => {
  const s = Number(form.value.triggerParams?.intervalSeconds ?? 0)
  if (!s) return '—'
  if (s % 86_400 === 0) { const d = s / 86_400; return `every ${d} day${d === 1 ? '' : 's'}` }
  if (s % 3_600  === 0) { const h = s / 3_600;  return `every ${h} hour${h === 1 ? '' : 's'}` }
  if (s % 60     === 0) { const m = s / 60;     return `every ${m} minute${m === 1 ? '' : 's'}` }
  return `every ${s} seconds`
})

// TODO Move somewhere else
const operatorPhrase: Record<ConditionOperator, (v?: string) => string> = {
  [ConditionOperator.Changed]:     ()  => 'change between polls',
  [ConditionOperator.Equals]:      (v) => `equal "${v ?? ''}"`,
  [ConditionOperator.GreaterThan]: (v) => `are greater than ${v ?? ''}`,
  [ConditionOperator.LessThan]:    (v) => `are less than ${v ?? ''}`,
  [ConditionOperator.Contains]:    (v) => `contain "${v ?? ''}"`,
}

const conditionSummary = computed(() => {
  const c = migrateCondition(form.value.triggerParams?.condition)
  if (c.kind === ConditionKind.None) {
    return { headline: 'Fires every poll cycle (no condition).', paths: [] as string[] }
  }
  if (c.kind === ConditionKind.Rule) {
    const agg = c.aggregation === ConditionAggregation.Any ? 'any' : 'all'
    const phrase = operatorPhrase[c.operator]?.(c.value) ?? c.operator
    const needsValue = OPERATORS_NEEDING_VALUE.has(c.operator) && !c.value
    const headline = needsValue
      ? `Fires when ${agg} of these fields ${phrase} (value missing — edit to set).`
      : `Fires when ${agg} of these fields ${phrase}.`
    return { headline, paths: c.paths ?? [] }
  }
  return { headline: '—', paths: [] }
})

// ── Actions ────────────────────────────────────────────────────────────────
const openEditAlert = () => {
  if (!form.value.id) return
  navigateTo(`/alerts/${form.value.id}?edit=1`)
}

const toggleStatus = async () => {
  if (!isExisting.value || !canActivate.value) return
  const next = form.value.status === AlertStatus.Active ? AlertStatus.Inactive : AlertStatus.Active
  try {
    const res: any = await alertService.setStatus(form.value.id as number, next)
    const newStatus = res?.data?.status ?? next

    // Optimistic local update. DO NOT call fetchAlerts() — that replaces
    // alerts.value with a fresh array, which cascades through `alert`
    // computed → `alertaInicial` prop → the watcher → fillFrom() and
    // resets form.value. That cascade is what causes the visible flash.
    form.value.status = newStatus

    // Sync the sidebar in-place. Direct property mutation on a reactive
    // proxy from useState updates anything reading `.status` (sidebar dot)
    // without changing the array reference — so the computed `alert` on the
    // page doesn't re-evaluate and AlertEditor stays mounted untouched.
    const idx = alerts.value.findIndex(a => a.id === form.value.id)
    if (idx >= 0 && alerts.value[idx]) {
      alerts.value[idx].status = newStatus
    }
  } catch (error: any) {
    console.error('Error toggling:', error)
  }
}

const doDelete = async () => {
  try {
    await alertService.delete(form.value.id as number)
    confirmingDelete.value = false
    await fetchAlerts()
    navigateTo('/')
  } catch (error: any) {
    console.error('Error deleting:', error)
  }
}

// ── Per-bundle edit modal ──────────────────────────────────────────────────
const editingBundleIndex = ref<number | null>(null)
const editingBundleDraft = ref<BundleModel | null>(null)
const bundleSnapshot     = ref('')          // JSON of the draft at modal-open time
const bundleSaving       = ref(false)
const confirmBundleDiscard = ref(false)     // inline "discard unsaved?" prompt

const openBundleEditor = (index: number) => {
  const b = form.value.bundles[index]
  if (!b) return
  editingBundleIndex.value = index
  // Deep copy so cancel really discards changes.
  editingBundleDraft.value = {
    ...b,
    discussion_list: [...b.discussion_list],
  }
  bundleSnapshot.value     = JSON.stringify(editingBundleDraft.value)
  confirmBundleDiscard.value = false
}

const bundleDirty = computed(() => {
  if (!editingBundleDraft.value) return false
  return JSON.stringify(editingBundleDraft.value) !== bundleSnapshot.value
})

// Real close (always discards). Use `requestCloseBundleEditor` from any UI
// affordance — it gates on `bundleDirty` and pops the confirmation prompt
// when there are unsaved changes.
const closeBundleEditor = () => {
  editingBundleIndex.value   = null
  editingBundleDraft.value   = null
  bundleSnapshot.value       = ''
  confirmBundleDiscard.value = false
}

const requestCloseBundleEditor = () => {
  if (bundleDirty.value) {
    confirmBundleDiscard.value = true
    return
  }
  closeBundleEditor()
}

const saveBundle = async () => {
  if (editingBundleIndex.value === null || !editingBundleDraft.value || !form.value.id) return
  bundleSaving.value = true
  try {
    // Patch only this bundle on the local form so the payload below carries
    // the user's intended state.
    const idx     = editingBundleIndex.value
    const draft   = editingBundleDraft.value
    const updated = form.value.bundles.map((b, i) => (i === idx ? draft : b))

    const payload = {
      id: form.value.id,
      title: form.value.title,
      description: form.value.description,
      input: form.value.input,
      triggerType: form.value.triggerType,
      status: form.value.status,
      triggerParams: form.value.triggerParams ?? {},
      bundles: updated.map(b => ({
        id: b.id,
        name: b.name,
        formating: b.formating,
        custom_script: b.custom_script,
        discussion_list: b.discussion_list.map(d => d.id),
      })),
    }
    await alertService.updateAlert(payload)
    await fetchAlerts()
    // The props watcher will refresh `form` from the canonical alerts list.
    closeBundleEditor()
  } catch (error: any) {
    console.error('Error saving bundle:', error)
    alert(`Error saving bundle:\n\n${error.data?.message || error.message || 'Unknown error'}`)
  } finally {
    bundleSaving.value = false
  }
}

// ── Manual test poll (polling alerts, inactive only) ──────────────────────
const testing    = ref(false)
const testResult = ref<any>(null)

const runTestPoll = async () => {
  if (!form.value.id) return
  testing.value = true
  try {
    // `await` is critical — without it testResult holds the Promise, not
    // the resolved RunResult, and the template renders nothing useful.
    testResult.value = await pollingService.testOnScreen(form.value.id)
  } catch (error: any) {
    testResult.value = { ok: false, error: error?.data?.statusMessage ?? error?.message ?? 'Test failed' }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="panel editor">

    <!-- ── Delete confirmation ──────────────────────────────── -->
    <div v-if="confirmingDelete" class="overlay">
      <div class="overlay-box">
        <h4>Delete this alert?</h4>
        <p>This removes the alert and all its bundles. This cannot be undone.</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-ghost"  @click="confirmingDelete = false">Cancel</button>
          <button type="button" class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- ── Per-bundle edit modal ────────────────────────────── -->
    <!-- All close affordances (backdrop / × / Cancel) go through
         `requestCloseBundleEditor`. If the draft is dirty, an inline confirm
         strip takes over the footer until the user picks Discard or Keep
         editing — no silent loss of edits.
         Backdrop clicks fire `@click.self` only; inner clicks keep bubbling
         to `document` so child dropdowns can detect outside-clicks. -->
    <div
      v-if="editingBundleIndex !== null && editingBundleDraft"
      class="overlay"
      @click.self="requestCloseBundleEditor"
    >
      <div class="overlay-box bundle-edit-modal">
        <div class="modal-head">
          <h4>Edit bundle {{ editingBundleIndex + 1 }}</h4>
          <button type="button" class="modal-close" title="Close" @click="requestCloseBundleEditor">✕</button>
        </div>
        <div class="modal-body">
          <BundleCard
            :bundle="editingBundleDraft"
            :index="editingBundleIndex"
            :available-discussions="availableDiscussions"
            :discussions-loading="discussionsLoading"
            :input-source="form.input"
            :alert-context="form"
            :trigger-params="form.triggerParams"
            :hide-remove="true"
            @update:bundle="editingBundleDraft = $event"
          />
        </div>
        <div v-if="confirmBundleDiscard" class="modal-foot discard-foot">
          <span class="discard-msg">⚠ Discard unsaved changes to this bundle?</span>
          <button type="button" class="btn btn-ghost" @click="confirmBundleDiscard = false">Keep editing</button>
          <button type="button" class="btn btn-danger" @click="closeBundleEditor">Discard</button>
        </div>
        <div v-else class="modal-foot">
          <button type="button" class="btn btn-ghost" @click="requestCloseBundleEditor">Cancel</button>
          <ButtonPrimary :disabled="bundleSaving" @click="saveBundle">
            {{ bundleSaving ? 'Saving…' : 'Save bundle' }}
          </ButtonPrimary>
        </div>
      </div>
    </div>

    <!-- ── Test-poll result modal ──────────────────────────────── -->
    <!-- Auto-opens when `testResult` is set by runTestPoll. Backdrop click /
         × / Close button all clear testResult to dismiss. No "dirty" state
         here — the data is a snapshot from the server, nothing to lose. -->
    <div
      v-if="testResult"
      class="overlay"
      @click.self="testResult = null"
    >
      <div class="overlay-box test-modal">
        <div class="modal-head">
          <h4>Test poll result</h4>
          <button type="button" class="modal-close" title="Close" @click="testResult = null">✕</button>
        </div>
        <div class="modal-body">

          <!-- Top-level error envelope (fetch/parse failure, etc.) -->
          <div v-if="testResult.error" class="test-error">
            ⚠ {{ testResult.error }}
          </div>

          <template v-else>
            <!-- Overall verdict -->
            <!--div class="test-verdict" :class="testResult.condition?.fired ? 'fired' : 'not-fired'">
              <span class="bullet">●</span>
              <span v-if="testResult.condition?.fired">Condition met — alert would fire.</span>
              <span v-else>Condition not met — alert would not fire.</span>
            </div>
            <p class="test-reason">{{ testResult.condition?.reason }}</p-->

            <div
              class="preview-strip"
              :class="testResult.condition?.fired ? 'ok' : 'no'"
            >
              <span class="bullet">●</span>
              <span v-if="testResult.condition?.fired">Condition met — alert would fire.</span>
              <span v-else>Condition not met — alert would not fire.</span>
              <p class="test-reason">{{ testResult.condition?.reason }}</p>

              <details v-if="testResult.condition?.baselineValue?.length" class="preview-detail">
                <summary>per-field breakdown</summary>
                <ul>

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
            </div>


            <!-- Per-field breakdown (reads from the verdict array we now
                 ride on `baselineValue` per the EvalResult contract) -->
            <template v-if="testResult.condition?.baselineValue?.length">

              
              <!--details class="preview-detail">
                <summary>Per-field breakdown</summary>
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
              </details-->
              
            </template>

            <!-- Per-bundle messages — exactly what each bundle would send -->
            <template v-if="testResult.bundleMessages?.length">
              <div class="divider"><span>Messages per bundle</span></div>
              <div class="bundle-messages">
                <div
                  v-for="bm in testResult.bundleMessages"
                  :key="bm.index"
                  class="bundle-message"
                >
                  <div class="bundle-message-head">
                    <span class="bundle-tag">BUNDLE {{ bm.index + 1 }}</span>
                    <span class="bundle-message-meta">
                      {{ bm.discussionCount }} discussion{{ bm.discussionCount === 1 ? '' : 's' }}
                      · {{ formatLabel(bm.formating) }}
                    </span>
                  </div>
                  <pre v-if="!bm.error" class="bundle-message-body">{{ bm.message }}</pre>
                  <pre v-else class="bundle-message-error">⚠ {{ bm.error }}</pre>
                </div>
              </div>
            </template>

            <!-- Raw parsed payload — collapsed by default, opt-in debug -->
            <details class="test-raw">
              <summary>Parsed source (raw)</summary>
              <pre>{{ JSON.stringify(testResult.parsed, null, 2) }}</pre>
            </details>
          </template>
        </div>
        <div class="modal-foot">
          <ButtonPrimary @click="testResult = null">Close</ButtonPrimary>
        </div>
      </div>
    </div>

    <!-- ── Header ─────────────────────────────────────────────── -->
    <!-- Title + description form an "identity block": what is this alert,
         what does it do. Status toggle stays on the right. Configuration
         details (source, URL, etc.) live in the body, not here. -->
    <div class="panel-head">
      <div class="head-left">
        <div class="head-title-block">
          <h2 class="view-title">{{ form.title || 'Untitled' }}</h2>
          <p v-if="form.description" class="view-subtitle">{{ form.description }}</p>
      </div>
      </div>
      <div class="head-right">
        <Toggle v-if="isExisting" 
          v-model:status="form.status"
          :canActivate="canActivate"
          @update:state="toggleStatus"
        /> 
      </div>
      
    </div>

    <!-- ── Body ──────────────────────────────────────────────── -->
    <!-- Compact info-rows: a single label-on-left / value-on-right pattern
         used everywhere. No fake textareas, no accent-soft badges except
         where they carry meaning (chips, the toggle, the primary CTA). -->
    <div class="panel-body">

      <dl class="info-list">
        <!--div v-if="form.description" class="info-row">
          <dt class="field-label">Description</dt>
          <dd class="info-value">{{ form.description }}</dd>
      </div-->

        <div v-if="form.input" class="info-row">
          <dt class="field-label">Source</dt>
          <dd class="info-value">
            <span class="source-badge">
          {{ form.input }}
              <span v-if="form.triggerType" class="source-via">via {{ form.triggerType }}</span>
        </span>
          </dd>
      </div>

        <!-- Webhook URL — webhook-trigger alerts only. -->
        <div v-if="form.triggerType === Trigger.Webhook && webhookUrl" class="info-row">
          <dt class="field-label">Endpoint</dt>
          <dd class="info-value">

            <URLCopyBox :url="webhookUrl"> </URLCopyBox>
        
          </dd>
      </div>
      </dl>

      <!-- ── Trigger details (polling only) ─────────────────── -->
      <template v-if="isPolling">
        <div class="divider"><span>Trigger configuration</span></div>

        <dl class="info-list">
          <div class="info-row">
            <dt class="field-label">URL</dt>
            <dd class="info-value">
              <URLCopyBox :url="form.triggerParams?.url || '——'"> </URLCopyBox>
            </dd>
            </div>
          <div class="info-row">
            <dt class="field-label">Polling</dt>
            <dd class="info-value">
              {{ form.triggerParams?.format || '—' }}
              <span class="info-secondary">· {{ intervalLabel }}</span>
            </dd>
          </div>
          <div class="info-row">
            <dt class="field-label">Condition</dt>
            <dd class="info-value">
              <p class="condition-text">{{ conditionSummary.headline }}</p>
              <div v-if="conditionSummary.paths.length > 0" class="path-list">
                <code v-for="p in conditionSummary.paths" :key="p" class="path-tag">{{ p }}</code>
          </div>
            </dd>
        </div>
        </dl>
      </template>

      <!-- ── Bundles — compact rows, not full cards ──────────── -->
      <div class="divider"><span>Bundles ({{ form.bundles.length }})</span></div>

      <div v-if="form.bundles.length === 0" class="bundles-hint">
        No bundles configured. Click <strong>Edit Alert</strong> to add one.
      </div>

      <div v-else class="bundle-list">
        <div v-for="(b, i) in form.bundles" :key="i" class="bundle-card">
          <div class="bundle-card-head">
            <span class="field-label">BUNDLE {{ i + 1 }}</span>
            <button type="button" class="btn-mini" @click="openBundleEditor(i)">
              <span class="btn-mini-icon">✎</span> Edit
            </button>
          </div>
          <dl class="info-list info-list-tight">
            <div class="info-row info-row-tight">
              <dt class="field-label">Discussions</dt>
              <dd class="info-value">
                <span v-if="b.discussion_list.length === 0" class="info-empty">— none —</span>
                <span v-else class="discussion-list">
                  <span v-for="d in b.discussion_list" :key="d.id" class="mini-tag">{{ d.title }}</span>
                </span>
              </dd>
            </div>
            <div class="info-row info-row-tight">
              <dt class="field-label">Format</dt>
              <dd class="info-value">{{ formatLabel(b.formating) }}</dd>
            </div>
          </dl>
        </div>
      </div>


      <!-- ── Test poll — polling alerts only, while inactive ──
           Inline panel kept minimal: intro + button. The rich result
           (verdict, per-field breakdown, per-bundle messages, raw payload)
           lives in a modal that auto-opens when testResult arrives. -->
      <template v-if="form.triggerType === Trigger.Polling && form.status === AlertStatus.Inactive">
        <div class="divider"><span>Test polling</span></div>
        <div class="test-panel">
          <p class="test-intro">
            Trigger the polling pipeline once manually. The alert won't be
            activated and no bundles will be fired — the result will open in
            a panel showing the per-field breakdown and the message each
            bundle would send.
          </p>
          <button
            type="button"
            class="btn btn-secondary btn-sm test-btn"
            :disabled="testing"
            @click="runTestPoll"
          >
            {{ testing ? 'Polling…' : 'Run test poll' }}
          </button>
        </div>
      </template>


    </div>
    

    

    <!-- ── Footer ─────────────────────────────────────────────── -->
    <div class="panel-foot">
      <button type="button" class="btn btn-danger-ghost" @click="confirmingDelete = true">Delete</button>
      <div class="foot-spacer"></div>
      <ButtonPrimary @click="openEditAlert">Edit Alert</ButtonPrimary>
    </div>

  </div>
</template>

<style scoped>
/* Surfaces (.panel / .panel-head / .panel-body / .panel-foot / .field* /
 * .btn* / .overlay* / .card-add / .chip / .chips) come from the global
 * stylesheet. Only editor-specific patterns live here: the view-mode detail rows, the test-poll panel,
 * the trigger details grid, the bundle-edit modal, and the divider.
 */

/* Header composition — same recipe as the wizard. */
.head-left  { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0;}
.head-right { display: flex; align-items: center; gap: var(--space-5); flex-shrink: 0; }
.head-tag {
  background: var(--color-border-subtle);
  color: var(--color-text-dim);
  font-size: var(--text-md);
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.head-subtitle{
  display: flex;
  align-self: flex-start;
  margin-left: var(--space-1);
  color: var(--color-text-dim);
  font-size: var(--text-md);

}
/* Title block — stacks the title and (when present) a muted subtitle
 * representing the description. Gives the header an "article masthead"
 * feel without growing when there's no description. */
.head-title-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;            /* allow ellipsis on the title */
  padding-left: var(--space-4);
}
.view-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.view-subtitle {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 400;
  font-style: italic;
  color: var(--color-text-faint);
  line-height: 1.4;
  /* Allow up to 2 lines, ellipsize after — keeps the header compact
   * even with long descriptions, while still showing more than one line
   * of context. */
  display: -webkit-box;
  /* Standard property for line clamping (when supported) */
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Active/inactive toggle ─────────────────────────────────
 * Track + thumb animate together with a spring-out easing
 * (cubic-bezier with slight overshoot near the end). On activation, the
 * track adds an accent glow and the thumb's shadow deepens for a sense
 * of "lifted". Hover slightly enlarges the thumb shadow for feedback. */
.toggle-wrap { display: flex; align-items: center; gap: var(--space-3); }
.toggle {
  width: 42px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border-default);
  border: none;
  position: relative;
  cursor: pointer;
  padding: 0;
  /* Smooth ease-out — the colour fades faster than the thumb travels,
   * so the eye reads the track changing first, then the thumb settling. */
  transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow      0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle.on {
  background: var(--color-accent);
  /* Soft glow ring — only visible on activation, fades cleanly on toggle off. */
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 18%, transparent);
}
.toggle:disabled { opacity: .4; cursor: not-allowed; }
.toggle:disabled.on { box-shadow: none; }

.knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--color-text-on-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  /* Spring-out: ease past the target slightly, then settle. Makes the
   * toggle feel physical without being bouncy. */
  transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.2s ease-out;
}
.toggle.on .knob {
  transform: translateX(20px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.toggle:hover:not(:disabled) .knob {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.40);
}
.toggle-label {
  font-size: var(--text-md);
  color: var(--color-text-muted);
  font-weight: 600;
  min-width: 54px;
}

/* ── Info-list pattern (label / value definition list) ────────
 * Used for description, source, URL, polling, condition, and inside each
 * bundle row. One unified rhythm replaces the patchwork of fake textareas,
 * accent badges, and ad-hoc grids that lived here before. */
.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin: 0;
}
.info-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-6);
  align-items: start;
}
 
.info-value {
  margin: 0;
  min-width: 0;              /* prevent overflow inside grid cell */
  color: var(--color-text-primary);
  font-size: var(--text-base);
  line-height: 1.5;
}
.info-secondary {
  margin-left: var(--space-1);
  color: var(--color-text-dim);
  font-size: var(--text-md);
}
.info-empty {
  color: var(--color-text-faint);
  font-style: italic;
}

/* Source badge — kept as an accent-soft pill because it's the most
 * load-bearing piece of meta-data ("what feeds this alert"). The accent
 * elsewhere in view mode is reserved for actions, so this is the only
 * non-action accent surface. */
.source-badge {
  display: inline-flex;
  align-items: center;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-base);
  font-weight: 500;
  padding: 5px var(--space-4);
  border-radius: var(--radius-md);
}
.source-via {
  margin-left: var(--space-2);
  color: var(--color-text-dim);
  font-size: var(--text-sm);
  font-weight: 400;
}

/* Tight variant — used inside bundle rows (narrower label column, smaller
 * vertical rhythm). Same pattern, dense layout. */
.info-list-tight { gap: var(--space-3); }
.info-row-tight  { grid-template-columns: 120px 1fr; gap: var(--space-4); }
.info-row-tight .field-label { padding-top: 2px; font-size: var(--text-sm); }
.info-row-tight .info-value { font-size: var(--text-md); }


/* ── Condition summary text + path tags ───────────────────────
 * Plain paragraph, not a coloured badge — the surrounding info-row already
 * delineates the section. Watched paths render as muted monospace tags
 * (neutral border-subtle background), not accent-soft chips, so the
 * accent colour stays meaningful elsewhere. */
.condition-text {
  margin: 0 0 var(--space-2);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  line-height: 1.5;
}
.path-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/*
.source-badge {
  display: inline-flex;
  align-items: center;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-base);
  font-weight: 500;
  padding: 5px var(--space-4);
  border-radius: var(--radius-md);
}

*/
.path-tag {
  display: inline-block;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-md);
  font-weight: 500;
  padding: 2px var(--space-3);
  border-radius: var(--radius-md);
}

/* ── Test poll panel ────────────────────────────── */
/* align-items: flex-start keeps the button at its natural width — without it,
 * flex's default stretch makes the secondary button span the panel. */
.test-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;

}
.test-intro { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); line-height: 1.5; }
.test-btn   { align-self: flex-start; }
.test-result { width: 100%; box-sizing: border-box; }

.test-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}
.test-error { color: var(--color-danger-bright); font-size: var(--text-md); font-family: var(--font-mono); }
.test-verdict {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-base);
  font-weight: 600;
}
.test-verdict .bullet { font-size: var(--text-lg); }
.test-verdict.fired              { color: var(--color-success-text); }
.test-verdict.fired     .bullet  { color: var(--color-success); }
.test-verdict.not-fired          { color: var(--color-text-secondary); }
.test-verdict.not-fired .bullet  { color: var(--color-text-dim); }
.test-reason { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); }

.test-value-block { display: flex; flex-direction: column; gap: var(--space-1); }
.test-value-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.test-value {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-code);
  border-radius: var(--radius-sm);
  color: var(--color-text-code);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  max-height: 160px;
  overflow-y: auto;
}

.test-raw { color: var(--color-text-dim); font-size: var(--text-md); }
.test-raw summary { cursor: pointer; user-select: none; padding: 2px 0; }
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

/* ── Divider ────────────────────────────────────── */
.divider { display: flex; align-items: center; gap: var(--space-3); margin: 2px 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border-subtle); }
.divider span {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.bundles-hint { color: var(--color-text-dim); font-size: var(--text-md); font-style: italic; margin: 0; }

/* ── Compact bundle rows (view mode) ─────────────────────────
 * Single-row card per bundle — header bar with the tag + Edit, and a
 * tight info-list underneath. No more 280px-min grid of full BundleCards;
 * those only show up in the edit modal where their full chrome makes sense. */
.bundle-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
  /*display: flex;
  flex-direction: column;
  gap: var(--space-3);*/
}
.bundle-card {
  background: var(--color-bundle-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);

}
.bundle-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.bundle-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--color-text-dim);
}

/* Neutral mini button — for "Edit" on bundle rows. Outlined rather than
 * solid so the only solid accent button in view mode is "Edit Alert"
 * (the primary footer CTA). */
.btn-mini {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: transparent;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
}
.btn-mini:hover {
  background: var(--color-border-subtle);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}
.btn-mini-icon { font-size: var(--text-md); }

/* Discussion list inside a bundle row — small neutral tags, not blue chips. */
.discussion-list {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.mini-tag {
  display: inline-block;
  padding: 1px var(--space-3);
  background: var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.foot-spacer { flex: 1; }

/* ── Test-poll result modal ─────────────────────────────────
 * Wider than the bundle-edit modal because it stacks: verdict header,
 * per-field breakdown, per-bundle message previews, and the raw payload
 * debug. Internally-scrolling so a 10-bundle alert with long messages
 * doesn't blow past the viewport. */
.test-modal {
  width: 92vw;
  max-width: 760px;
  max-height: 88vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.test-modal .modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
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

/* ── Per-bundle edit modal ──────────────────────── */
.bundle-edit-modal {
  width: 92vw;
  max-width: 560px;
  max-height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}
.modal-head h4 {
  margin: 0;
  flex: 1;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
}
.modal-close {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: var(--text-lg);
  cursor: pointer;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}
.modal-close:hover { color: var(--color-text-primary); background: var(--color-border-subtle); }

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-5) var(--space-6);
}
.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
}


/* Discard-confirm strip that takes over the footer when the user tries to
 * close while dirty. The warning message pushes the action buttons right. */
.modal-foot.discard-foot { background: var(--color-warning-soft); }
.discard-msg {
  flex: 1;
  color: var(--color-warning-text);
  font-size: var(--text-md);
  font-weight: 600;
}
</style>
