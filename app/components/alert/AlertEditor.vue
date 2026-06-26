<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Formatting,
  AlertStatus,
  ConditionKind,
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  migrateCondition,
  isPolling as isPollingType,
  Source,
  type DiscussionModel,
  type BundleModel,
  type AlertModel,
} from '#shared/constants'
import { alertService } from '~/utils/alertService'

const { t } = useI18n()

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
  input: '',                       // Source — the alert's source of truth
  status: AlertStatus.Draft,
  token: '',
  alertParams: {},
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
    // `a.input` IS the Source; alertParams carries only type-specific config.
    const alertParams = { ...((a as any).alertParams ?? {}) } as Record<string, any>
    form.value = {
      id: a.id,
      title: a.title || '',
      description: a.description || '',
      input: a.input,
      status: a.status || AlertStatus.Draft,
      token: a.token || '',
      alertParams,
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
const isPolling   = computed(() => isPollingType(form.value.input))
const isWebhook   = computed(() => form.value.input === Source.Webhook)
// Source name surfaced in the view-mode "Source" row. With the binary
// Source enum, this IS just `form.input`.
const sourceName  = computed(() => form.value.input ?? '')

// View-mode INPUT block title. The source IS the heading — "Polling Alert"
// or "Webhook Alert" — no separate label + tag dance. Extending: another
// branch here per future Source ("Cron Alert", "Olvid Message Alert", …).
const inputTitle  = computed(() => {
  if (isPolling.value) return 'Polling Alert'
  if (isWebhook.value) return 'Webhook Alert'
  return form.value.input ? `${form.value.input} Alert` : 'Alert'
})

// Per-bundle readiness signal shown next to the title in the OUTPUT table.
// "ready"      — at least one destination AND any required script is set.
// "no-dest"    — no discussion picked → bundle wouldn't deliver anywhere.
// "no-script"  — Custom-format bundle with an empty script → would render blank.
// The pip's tooltip carries the human-readable reason.
type BundleStatus = { kind: 'ready' | 'no-dest' | 'no-script', label: string }
const bundleStatus = (b: BundleModel): BundleStatus => {
  if (b.discussion_list.length === 0) return { kind: 'no-dest',   label: 'No destinations' }
  const needsScript = b.formating === Formatting.Custom || b.formating === Formatting.PollingCustom
  if (needsScript && !(b.custom_script ?? '').trim()) return { kind: 'no-script', label: 'Custom format set but no script' }
  return { kind: 'ready', label: 'Ready' }
}

// Names of the bundle's destinations, one per line, for the count-badge tooltip.
const destNames = (b: BundleModel) => b.discussion_list.map(d => d.title).join('\n')

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
    case Formatting.Unformatted:    return t('bundleCard.format.unformatted')
    case Formatting.Simple:         return t('bundleCard.format.simple')
    case Formatting.Custom:         return t('bundleCard.format.custom')
    case Formatting.PollingDefault: return t('bundleCard.format.pollingDefault')
    case Formatting.PollingCustom:  return t('bundleCard.format.pollingCustom')
    default:                        return String(f)
  }
}

// ── Polling trigger-detail labels ──────────────────────────────────────────
const intervalLabel = computed(() => {
  const s = Number((form.value.alertParams as any)?.intervalSeconds ?? 0)
  if (!s) return t('editor.interval.empty')
  if (s % 86_400 === 0) {
    const d = s / 86_400
    return t(d === 1 ? 'editor.interval.everyDay' : 'editor.interval.everyDays', { n: d })
  }
  if (s % 3_600 === 0) {
    const h = s / 3_600
    return t(h === 1 ? 'editor.interval.everyHour' : 'editor.interval.everyHours', { n: h })
  }
  if (s % 60 === 0) {
    const m = s / 60
    return t(m === 1 ? 'editor.interval.everyMinute' : 'editor.interval.everyMinutes', { n: m })
  }
  return t('editor.interval.everySeconds', { n: s })
})

// TODO Move somewhere else
// Operator → translated phrase (used in the view-mode condition summary).
// `value` is interpolated by vue-i18n's `t()` placeholders, so we can't keep
// the original template-literal map shape — return the resolved phrase here
// and let conditionSummary string it together.
const operatorPhrase = (op: ConditionOperator, v?: string): string => {
  const value = v ?? ''
  switch (op) {
    case ConditionOperator.Changed:     return t('editor.condition.phrase.changed')
    case ConditionOperator.Equals:      return t('editor.condition.phrase.equals',      { value })
    case ConditionOperator.GreaterThan: return t('editor.condition.phrase.greaterThan', { value })
    case ConditionOperator.LessThan:    return t('editor.condition.phrase.lessThan',    { value })
    case ConditionOperator.Contains:    return t('editor.condition.phrase.contains',    { value })
    default:                            return String(op)
  }
}

const conditionSummary = computed(() => {
  const c = migrateCondition((form.value.alertParams as any)?.condition)
  if (c.kind === ConditionKind.None) {
    return { headline: t('editor.condition.summaryNone'), paths: [] as string[] }
  }
  if (c.kind === ConditionKind.Rule) {
    const isAny = c.aggregation === ConditionAggregation.Any
    const phrase = operatorPhrase(c.operator, c.value)
    const needsValue = OPERATORS_NEEDING_VALUE.has(c.operator) && !c.value
    const key = needsValue
      ? (isAny ? 'editor.condition.summaryRuleAnyMissingValue' : 'editor.condition.summaryRuleAllMissingValue')
      : (isAny ? 'editor.condition.summaryRuleAny'             : 'editor.condition.summaryRuleAll')
    return { headline: t(key, { phrase }), paths: c.paths ?? [] }
  }
  return { headline: t('common.emDash'), paths: [] }
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
      status: form.value.status,
      alertParams: form.value.alertParams ?? {},
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
    alert(`${t('editor.errors.savingBundle')}\n\n${error.data?.message || error.message || t('common.unknownError')}`)
  } finally {
    bundleSaving.value = false
  }
}
</script>

<template>
  <div class="panel editor">

    <!-- ── Delete confirmation ──────────────────────────────── -->
    <div v-if="confirmingDelete" class="overlay">
      <div class="overlay-box">
        <h4>{{ $t('wizard.deleteModal.title') }}</h4>
        <p>{{ $t('wizard.deleteModal.message') }}</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-ghost"  @click="confirmingDelete = false">{{ $t('button.cancel') }}</button>
          <button type="button" class="btn btn-danger" @click="doDelete">{{ $t('button.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- ── Per-bundle edit modal ────────────────────────────── -->
    <div
      v-if="editingBundleIndex !== null && editingBundleDraft"
      class="overlay"
      @click.self="requestCloseBundleEditor"
    >
      <div class="overlay-box bundle-edit-modal">
        <div class="modal-head">
          <h4>{{ $t('editor.bundleModal.title', { n: editingBundleIndex + 1 }) }}</h4>
          <button type="button" class="modal-close" :title="$t('editor.bundleModal.closeTitle')" @click="requestCloseBundleEditor">✕</button>
        </div>
        <div class="modal-body">
          <BundleCard
            :bundle="editingBundleDraft"
            :index="editingBundleIndex"
            :available-discussions="availableDiscussions"
            :discussions-loading="discussionsLoading"
            :input-source="sourceName"
            :alert-context="form"
            :alert-params="form.alertParams"
            :hide-remove="true"
            @update:bundle="editingBundleDraft = $event"
          />
        </div>
        <div v-if="confirmBundleDiscard" class="modal-foot discard-foot">
          <span class="discard-msg">{{ $t('editor.bundleModal.discardWarning') }}</span>
          <button type="button" class="btn btn-ghost" @click="confirmBundleDiscard = false">{{ $t('editor.bundleModal.keepEditingButton') }}</button>
          <button type="button" class="btn btn-danger" @click="closeBundleEditor">{{ $t('editor.bundleModal.discardButton') }}</button>
        </div>
        <div v-else class="modal-foot">
          <button type="button" class="btn btn-ghost" @click="requestCloseBundleEditor">{{ $t('editor.bundleModal.cancelButton') }}</button>
          <ButtonPrimary :disabled="bundleSaving" @click="saveBundle">
            {{ bundleSaving ? $t('editor.bundleModal.savingButton') : $t('editor.bundleModal.saveButton') }}
          </ButtonPrimary>
        </div>
      </div>
    </div>

    <div class="panel-head view-head">
      <div class="head-main">
        <div class="head-titlebar">
          <h2 class="view-title">{{ form.title || $t('common.untitled') }}</h2>
          <div class="head-actions">
            <button type="button" class="btn btn-primary btn-sm" @click="openEditAlert">
              {{ $t('editor.header.editAlert') }}
            </button>
            <button type="button" class="btn btn-danger-ghost btn-sm" :title="$t('button.delete')" @click="confirmingDelete = true">
              <FontAwesomeIcon :icon="['fas', 'trash-can']" />
            </button>
          </div>
        </div>

        <!-- Meta strip: status toggle + source kind + bundle count. -->
        <div class="head-meta">
          <Toggle v-if="isExisting"
            v-model:status="form.status"
            :canActivate="canActivate"
            @update:state="toggleStatus"
          />
          <span class="meta-sep" aria-hidden="true" />
          <span class="meta-tag">{{ inputTitle }}</span>
          <span class="meta-sep" aria-hidden="true" />
          <span class="meta-dim">
            {{ form.bundles.length }}
            {{ form.bundles.length === 1 ? 'bundle' : 'bundles' }}
          </span>
        </div>

        

        <p v-if="form.description" class="view-subtitle">{{ form.description }}</p>
      </div>
    </div>


    <div class="panel-body">

      <!-- ── INPUT block ───────────────────────────────────────── -->
      <div class="data-block">
        <h3 class="data-title">{{ inputTitle }}</h3>
        <dl class="data-grid">
          <template v-if="isWebhook">
            <div v-if="webhookUrl" class="data-row">
              <dt class="data-label">{{ $t('editor.view.fields.endpoint') }}</dt>
              <dd class="data-value">
                <URLCopyBox :url="webhookUrl"></URLCopyBox>
              </dd>
            </div>
          </template>

          <template v-else-if="isPolling">
            <div class="data-row">
              <dt class="data-label">{{ $t('editor.view.fields.url') }}</dt>
              <dd class="data-value">
                <URLCopyBox :url="(form.alertParams as any)?.url || '——'"></URLCopyBox>
              </dd>
            </div>
            <div class="data-row">
              <dt class="data-label">{{ $t('editor.view.fields.polling') }}</dt>
              <dd class="data-value">
                {{ (form.alertParams as any)?.format || $t('editor.interval.empty') }}
                <span class="dim">· {{ intervalLabel }}</span>
              </dd>
            </div>
            <div class="data-row">
              <dt class="data-label">{{ $t('editor.view.fields.condition') }}</dt>
              <dd class="data-value">
                <p class="condition-text">{{ conditionSummary.headline }}</p>
                <div v-if="conditionSummary.paths.length > 0" class="path-list">
                  <code v-for="p in conditionSummary.paths" :key="p" class="path-tag">{{ p }}</code>
                </div>
              </dd>
            </div>
          </template>
        </dl>
      </div>

      <!-- ── OUTPUT block ────────────────────────────────────────-->
      <div class="data-block">
        <h3 class="data-title">Bundles ({{ form.bundles.length }})</h3>

        <div v-if="form.bundles.length === 0" class="bundles-hint">
          <i18n-t keypath="editor.view.noBundles" tag="span">
            <template #editAlert><strong>{{ $t('editor.view.noBundlesEditAlert') }}</strong></template>
          </i18n-t>
        </div>

        <div v-else class="bundles-table">
          <div class="bundles-row bundles-head">
            <div>#</div>
            <div>Title</div>
            <div>Format</div>
            <div class="cell-num">Destinations</div>
            <div></div>
          </div>
          <div
            v-for="(b, i) in form.bundles"
            :key="b.id ?? i"
            class="bundles-row"
          >
            <div class="cell-index">{{ String(i + 1).padStart(2, '0') }}</div>

            <div class="cell-title-wrap">
              <span
                class="status-pip"
                :class="`pip-${bundleStatus(b).kind}`"
                :title="bundleStatus(b).label"
                aria-hidden="true"
              />
              <span class="cell-title" :title="b.name || `Bundle ${i + 1}`">
                {{ b.name || `Bundle ${i + 1}` }}
              </span>
            </div>

            <div class="cell-format">
              <span class="format-chip">{{ formatLabel(b.formating) }}</span>
            </div>

            <div class="cell-num">
              <span
                v-if="b.discussion_list.length === 0"
                class="dest-count dest-count-empty"
                title="No destinations set"
              >0</span>
              <span
                v-else
                class="dest-count"
                :title="destNames(b)"
              >{{ b.discussion_list.length }}</span>
            </div>

            <button
              type="button"
              class="cell-edit"
              title="Edit bundle"
              @click="openBundleEditor(i)"
            >
              <FontAwesomeIcon :icon="['fas', 'pencil']" />
            </button>
          </div>
        </div>
      </div>

      <TestPoll v-if="isPolling && form.status === AlertStatus.Inactive"
        :alertId="form.id"
      />

    </div>
  </div>
</template>

<style scoped>
/* ── View-mode header ──────────────────────────────────────────── */
.view-head {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
}
.head-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.head-titlebar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}
.head-actions {
  display: flex;
  align-items:center;
  margin-left: auto;
  flex-shrink: 0;
  gap: var(--space-2);
}
.view-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}
.head-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: var(--text-sm);
}
.meta-tag {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
}
.meta-dim {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.meta-sep {
  width: 1px;
  height: 14px;
  background: var(--color-border-default);
}
.view-subtitle {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 400;
  font-style: italic;
  color: var(--color-text-faint);
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bundles-hint { color: var(--color-text-dim); font-size: var(--text-md); font-style: italic; margin: var(--space-3) 0; }

/* ── Flat view-mode blocks ──────────────────────────────────────
 * No card layer, no nested section frames. Each block is just:
 *   1. A title (the source IS the heading).
 *   2. A flat table of rows divided by thin lines. */
.data-block { margin-bottom: var(--space-8); }
.data-block:last-child { margin-bottom: 0; }

.data-title {
  margin: 0;
  padding: 0 0 var(--space-3);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-default);
}

.data-grid {
  margin: 0; padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.data-row {
  display: flex; flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px dashed var(--color-border-subtle);
}
.data-row:last-child { border-bottom: none; padding-bottom: 0; }
.data-label {
  margin: 0; font-size: 11px; font-weight: 700;
  letter-spacing: 0.5px; text-transform: uppercase;
  color: var(--color-text-dim);
}
.data-value {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-base);
  line-height: 1.5;
  min-width: 0;
}
.data-value .dim { color: var(--color-text-dim); margin-left: var(--space-2); }

/* OUTPUT — bundle table */
.bundles-table {
  display: flex; flex-direction: column; gap: var(--space-3);
}
.bundles-head { display: none; }
.bundles-row {
  display: grid;
  grid-template-columns: 40px 1.4fr 130px 1.6fr 36px;
  gap: var(--space-4); align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.bundles-row:hover {
  border-color: var(--color-border-default);
  box-shadow: var(--shadow-sm);
}
.cell-index {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-faint);
  letter-spacing: 0.5px;
}
.cell-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.status-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pip-ready     { background: var(--color-success); }
.pip-no-dest   { background: var(--color-warning); }
.pip-no-script { background: var(--color-warning); }
.cell-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.cell-format { min-width: 0; }
.format-chip {
  display: inline-block;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
.cell-num {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-secondary);
}
.dest-count {
  display: inline-block;
  padding: 1px var(--space-3);
  background: var(--color-border-subtle);
  border-radius: var(--radius-sm);
  cursor: help;
}
.dest-count-empty {
  color: var(--color-text-faint);
  background: transparent;
  border: 1px dashed var(--color-border-default);
}
.cell-edit {
  background: transparent;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color .15s, color .15s, border-color .15s;
}
.cell-edit:hover {
  background: var(--color-border-subtle);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

/* ── Condition summary text + path tags ─────────────────────── */
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

.foot-spacer { flex: 1; }

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
.modal-foot.discard-foot { background: var(--color-warning-soft); }
.discard-msg {
  flex: 1;
  color: var(--color-warning-text);
  font-size: var(--text-md);
  font-weight: 600;
}
</style>
