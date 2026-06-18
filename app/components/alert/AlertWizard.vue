<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized} from 'vue-router'
import {
  Formatting,
  AlertStatus,
  Trigger,
  ConditionKind,
  PollingFormat,
  isPollingSource,
  sourceTriggers,
  compactCondition,
  migrateCondition,
  type AlertModel,
  type BundleModel,
  type DiscussionModel,
} from '#shared/constants'
import { alertService } from '~/utils/alertService';
import { snapshot } from 'node:test';

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
}>(), {
  alertaInicial: null,
})

const { availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts()

//  JSON snapshot taken when entering edit mode
const formSnapshot = ref('') 
// Saves route destination when trying to leave the page
const pendingLeave = ref<RouteLocationNormalized | null>(null)
// One-shot escape hatch: when the user confirms Discard or Save-as-draft, set
// this to true so the next navigation slips past the guard. The guard resets
// it on read so it can't accidentally suppress a future leave.
const bypassGuard = ref(false)
// Current step in the alert configuration
const currentStep = ref(1)
const saving = ref(false)
const showDiscardWarning = ref(false)
const confirmingDelete = ref(false)
const deleting = ref(false)


const isDirty = computed(() => {
  //if (!editing.value) return false
  return JSON.stringify(form.value) !== formSnapshot.value
})


// Intercept ANY route change. Two hooks are needed: Leave fires when the
// route DEFINITION changes (e.g. /alerts/[id] → /, /alerts/new), Update fires
// when the same definition is reused with different params/query
// (e.g. /alerts/123?edit=1 → /alerts/456 — sidebar click — or the post-save
// nav stripping ?edit=1). Without Update, leaving edit mode for ANOTHER
// alert in the sidebar would slip through silently.
const guardNavigation = (to: RouteLocationNormalized) => {
  if (bypassGuard.value) { bypassGuard.value = false; return true }
  if (!isDirty.value) return true
  //if (!hasAnyInput.value) return true
  pendingLeave.value = to
  showDiscardWarning.value = true
  return false
}

// Call guard Navigation whenever route is about to be changed from outside of the wizard
onBeforeRouteLeave(guardNavigation)
onBeforeRouteUpdate(guardNavigation)

// Browser-level: tab close, hard refresh, address bar nav. We set BOTH
// preventDefault AND returnValue — preventDefault is the modern trigger but
// older browsers (and some current Safari builds) still require returnValue
// to be truthy for the native "Leave site?" dialog to actually show. The
// `returnValue` setter is marked @deprecated, but every browser still honors
// it; skipping it costs reliability for no real gain.
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  //if (!hasAnyInput.value) return
  if (isDirty.value) e.preventDefault()
  e.preventDefault()
}

const snapform = () =>{
  formSnapshot.value = JSON.stringify(form.value)
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  snapform()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))


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

const blankBundle = (): BundleModel => ({
  discussion_list: [],
  formating: Formatting.Unformatted,
  custom_script: '',
})

const form = ref<AlertModel>(blankForm())
const bundles = ref<BundleModel[]>([])

// Last parsed payload received from the ConditionEditor's retrieve. Used to
// power the live preview in BundleCard's polling-default format. Not persisted.
const lastPollPayload = ref<any>(null)

const isExisting = computed(() => form.value.id !== null)

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
      bundles: [],
    }
    bundles.value = (a.bundles || []).map(b => ({
      id: b.id,
      name: b.name,
      formating: (b.formating as Formatting) || Formatting.Unformatted,
      custom_script: b.custom_script || '',
      discussion_list: resolveDiscussions(b.discussion_list as any),
    }))
  } else {
    form.value = blankForm()
    bundles.value = []
  }
  currentStep.value = 1
}

watch(() => props.alertaInicial, (a) => fillFrom(a), { immediate: true })

// Re-resolve discussion titles once the discussion list finishes loading.
watch(availableDiscussions, (available) => {
  if (available.length === 0) return
  bundles.value = bundles.value.map(b => ({
    ...b,
    discussion_list: resolveDiscussions(b.discussion_list),
  }))
})

// ── Bundle helpers ────────────────────────────────────────────────────────
const addBundle = () => {
  bundles.value.push(blankBundle())
}
const updateBundle = (index: number, newBundle: BundleModel) => {
  bundles.value[index] = newBundle
}
const removeBundle = (index: number) => {
  bundles.value.splice(index, 1)
}

const hasEmptyBundle = computed(() =>
  bundles.value.some(b => b.discussion_list.length === 0),
)

// ── Derived state ─────────────────────────────────────────────────────────
const isPolling = computed(() => isPollingSource(form.value.input))
const isWebhook = computed(
  () => !!form.value.input && form.value.triggerType === Trigger.Webhook,
)

// Auto-derive triggerType from the chosen input source.
watch(() => form.value.input, (src) => {
  // TODO Should really be erasing trigger*? Maybe we can wait to saving before erasing (error-proof)
  if (!src) {
    form.value.triggerType = ''
    form.value.triggerParams = {}
    return
  }
  const triggers = sourceTriggers[src as keyof typeof sourceTriggers] ?? []
  form.value.triggerType = triggers[0] ?? ''
  if (isPollingSource(src)) {
    form.value.triggerParams = {
      url: '',
      format: PollingFormat.XML,
      intervalSeconds: 300,
      condition: { kind: ConditionKind.None },
      ...(form.value.triggerParams ?? {}),
    }
  } else {
    form.value.triggerParams = {}
  }
})

// ── Steps ─────────────────────────────────────────────────────────────────
// Three steps total for every source. The middle step adapts to the source:
//   polling → ConditionEditor;  webhook → webhook-URL info card.
// Polling-specific URL / format / timing now lives inline in step 1, right
// under the input-source selector.
type StepKey = 'general' | 'trigger' | 'bundle'

const isPollingConfigComplete = computed(() => {
  if (!isPolling.value) return true
  const p = form.value.triggerParams ?? {}
  return !!p.url && !!p.format && !!p.intervalSeconds
})

const isStep1Complete = computed(
  () => !!form.value.title && !!form.value.input && isPollingConfigComplete.value,
)

const isConditionComplete = computed(() => {
  if (!isPolling.value) return true
  const c = (form.value.triggerParams?.condition ?? {}) as any
  if (c.kind === ConditionKind.None) return true
  if (c.kind === ConditionKind.Rule) {
    if (!Array.isArray(c.paths) || c.paths.length === 0) return false
    // Operators other than `changed` need a literal value.
    if (c.operator && c.operator !== 'changed' && !c.value) return false
    return true
  }
  return false
})

const stepDefs = computed<Array<{ key: StepKey; title: string; description: string; disabled: boolean }>>(() => [
  {
    key:         'general',
    title:       'General',
    description: isPolling.value ? 'Title, source & polling config' : 'Title & source',
    disabled:    false,
  },
  {
    key:         'trigger',
    title:       'Trigger',
    description: isPolling.value ? 'When to fire' : 'Webhook URL info',
    disabled:    !isStep1Complete.value,
  },
  {
    key:         'bundle',
    title:       'Bundles',
    description: 'Add notification targets',
    disabled:    !isStep1Complete.value || !isConditionComplete.value,
  },
])

const currentStepKey = computed<StepKey>(
  () => stepDefs.value[currentStep.value - 1]?.key ?? 'general',
)

// Clamp the index when the step list shrinks (e.g. switching polling → webhook).
watch(stepDefs, (defs) => {
  if (currentStep.value > defs.length) currentStep.value = defs.length
})

// The last config step (before the bundle step) is where the user can save
// without a bundle: step 2 for webhook, step 3 for polling.
const isOnLastConfigStep = computed(() => {
  const defs = stepDefs.value
  const bundleIndex = defs.findIndex(d => d.key === 'bundle')
  return currentStep.value === bundleIndex // i.e. the step right before bundle
})

const isOnBundleStep = computed(() => currentStepKey.value === 'bundle')

const canAdvance = computed(() => {
  switch (currentStepKey.value) {
    case 'general': return isStep1Complete.value
    case 'trigger': return isConditionComplete.value
    default:        return false
  }
})


// ── Navigation ────────────────────────────────────────────────────────────
const hasAnyInput = computed(
  () =>
    !!form.value.title ||
    !!form.value.description ||
    !!form.value.input ||
    bundles.value.length > 0,
)

const requestBack = () => {
  //if (hasAnyInput.value) showDiscardWarning.value = true
  if (isDirty.value) showDiscardWarning.value = true
  else navigateTo('/')
}

const discardAndExit = () => {
  showDiscardWarning.value = false
  const target = pendingLeave.value
  pendingLeave.value = null
  // Tell the guard to let the next navigation through, otherwise it would
  // re-open this same modal because hasAnyInput is still true.
  bypassGuard.value = true
  navigateTo(target ?? '/')
}

const dismissDiscard = () => {
  showDiscardWarning.value = false
  pendingLeave.value = null
}

// Delete the currently-loaded alert. Available in the wizard for ANY existing
// alert (drafts, inactive, active) — drafts open in the wizard, so without
// this they'd have nowhere to be deleted from.
const doDelete = async () => {
  if (!form.value.id) return
  deleting.value = true
  try {
    await alertService.delete(form.value.id as number)
    confirmingDelete.value = false
    await fetchAlerts()
    bypassGuard.value = true
    navigateTo('/')
  } catch (error: any) {
    console.error('Error deleting:', error)
    alert(`Error deleting alert:\n\n${error?.data?.message || error?.message || 'Unknown error'}`)
  } finally {
    deleting.value = false
  }
}

// Modal "Save as draft": persist, then continue to wherever the user was
// actually trying to go (sidebar target, or fallback to the alert's own page).
const saveDraftAndLeave = async () => {
  await save(true, false)
  if (!form.value.id) return // save failed — keep the modal up so user can retry/discard
  showDiscardWarning.value = false
  const target = pendingLeave.value
  pendingLeave.value = null
  bypassGuard.value = true
  navigateTo(target ?? '/alerts/' + form.value.id)
}

const next = () => {
  if (!canAdvance.value) return
  if (currentStep.value < stepDefs.value.length) currentStep.value++
}

const back = () => {
  if (currentStep.value > 1) currentStep.value--
}

// ── Persistence ───────────────────────────────────────────────────────────
// Compact the polling condition on the way out: drop unused fields when
// kind === None, drop `value` for operators that don't use it. The in-memory
// shape preserves all fields so the user can flip between modes without
// losing context; only the DB-bound payload gets pruned.
const buildPayload = (status: AlertStatus) => {
  const tp: any = { ...(form.value.triggerParams ?? {}) }
  if (isPolling.value && tp.condition) {
    tp.condition = compactCondition(migrateCondition(tp.condition))
  }
  return ({
  id: form.value.id,
  title: form.value.title,
  description: form.value.description,
  input: form.value.input,
  triggerType: form.value.triggerType,
  status,
  triggerParams: tp,
  bundles: bundles.value.map(b => ({
    id: b.id,
    name: b.name,
    formating: b.formating,
    custom_script: b.custom_script,
    discussion_list: b.discussion_list.map(d => d.id),
  })),
})
}

const canSaveDraft = computed(() => !!form.value.title)

// Would the form, as it stands right now, save as a complete (non-Draft)
// alert? Used by the per-step Save button so it can offer "Save alert"
// instead of "Save as draft" the moment everything's in place — no need to
// wait until the user reaches the bundle step.
const wouldBeComplete = computed(() =>
  !!form.value.title &&
  !!form.value.input &&
  isPollingConfigComplete.value &&
  isConditionComplete.value &&
  bundles.value.length > 0 &&
  !hasEmptyBundle.value,
)

// Resolves to the status the alert SHOULD have after this save. Drafts when
// the form isn't complete; otherwise preserve the alert's existing status —
// editing an Active alert that's still complete must NOT silently demote it
// to Inactive (it would stop firing).
const effectiveFinalStatus = computed<AlertStatus>(() => {
  if (!wouldBeComplete.value) return AlertStatus.Draft
  if (isExisting.value && form.value.status === AlertStatus.Active) {
    return AlertStatus.Active
  }
  return AlertStatus.Inactive
})

// forceDraft = "Save as draft" was clicked. Otherwise the final-save path
// applies the empty-bundle rule.
const save = async (forceDraft: boolean, navigateAfter: boolean) => {
  if (!form.value.title) return alert('Title is mandatory')
  const status = forceDraft ? AlertStatus.Draft : effectiveFinalStatus.value
  saving.value = true
  try {
    const payload = buildPayload(status)
    const res: any = isExisting.value
      ? await alertService.updateAlert(payload)
      : await alertService.saveAlert(payload)
    const saved = res?.data
    if (saved) {
      form.value.id     = saved.id     ?? form.value.id
      form.value.status = saved.status ?? form.value.status
      form.value.token  = saved.token  ?? form.value.token
      // Stamp returned ids back onto local bundles so subsequent saves
      // update-in-place instead of recreating.
      const savedBundles: any[] = saved.bundles ?? []
      bundles.value = bundles.value.map((b, i) => ({
        ...b,
        id: savedBundles[i]?.id ?? b.id,
      }))
    }
    await fetchAlerts()
    if (navigateAfter && form.value.id) {
      // Bypass the unsaved-changes guard: the alert is now persisted, so
      // hasAnyInput == true should not be treated as "dirty".
      bypassGuard.value = true
      await navigateTo('/alerts/' + form.value.id)
    }
  } catch (error: any) {
    console.error('Error saving:', error.data || error)
    alert(`Error saving alert:\n\n${error.data?.message || error.message || 'Unknown error'}`)
  } finally {
    saving.value = false
  }
}

</script>

<template>
  <div class="wizard-root">

    <div v-if="showDiscardWarning" class="overlay">
      <div class="overlay-box">
        <h4>Unsaved changes</h4>
        <p>If you leave now, your progress will be lost. Would you like to save this alert as a draft before leaving?</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-secondary" v-if="canSaveDraft" :disabled="saving" @click="saveDraftAndLeave">
            {{ saving ? 'Saving…' : 'Save as draft' }}
          </button>
          <button type="button" class="btn btn-ghost" @click="dismissDiscard">Continue editing</button>
          <button type="button" class="btn btn-danger" @click="discardAndExit">Discard</button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation — for existing alerts (drafts included). -->
    <div v-if="confirmingDelete" class="overlay">
      <div class="overlay-box">
        <h4>Delete this alert?</h4>
        <p>This removes the alert and all its bundles. This cannot be undone.</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-ghost" @click="confirmingDelete = false">Cancel</button>
          <button type="button" class="btn btn-danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stepper sits ABOVE the creation card -->
    <div class="wizard-stepper">
      <Stepper v-model="currentStep" :steps="stepDefs" />
    </div>

    <div class="panel wizard">

    <!-- Header mirrors the view-mode layout: tag + title-block (with status
         badge inline at the title row) + back button. The title-block stacks
         title and description so they sit in the same place in BOTH modes —
         user just sees the same surface transition from read-only to inputs. -->
    <div class="panel-head">
      <div class="head-left">
        <div class="head-title-block">
          <div class="title-row">
            <input
              v-model="form.title"
              type="text"
              placeholder="Untitled alert..."
              class="title-input"
              aria-label="Alert title"
            />
            <span v-if="isExisting && form.status === AlertStatus.Draft" class="status-badge draft">DRAFT</span>
            <span v-else-if="isExisting && form.status === AlertStatus.Inactive" class="status-badge inactive">INACTIVE</span>
            <span v-else-if="isExisting && form.status === AlertStatus.Active" class="status-badge active">ACTIVE</span>
          </div>
          <input
            v-model="form.description"
            type="text"
            placeholder="Add a brief description…"
            class="description-input"
            aria-label="Alert description"
          />
        </div>
      </div>
      <button type="button" class="btn btn-ghost" @click="requestBack">← Back to list</button>
    </div>

    <div class="panel-body">

      <!-- ── STEP 1 ─ General (source + inline polling cfg) ──────────────
           Title + description moved to the panel-head so editing them is
           visible and reachable from any step, not just this one. -->
      <template v-if="currentStepKey === 'general'">
        <div class="field">
          <label class="field-label">Input Source <span class="field-required">*</span></label>
          <InputSourceSelector v-model="form.input" />
          <p v-if="form.triggerType" class="field-hint">
            Communication: <strong>{{ form.triggerType }}</strong>
            — how this source talks to the alert system.
          </p>
        </div>

        <!-- Polling sources expose URL / format / timing inline. -->
        <div v-if="isPolling" class="field">
          <label class="field-label">Polling configuration <span class="field-required">*</span></label>
          <TriggerParamsEditor
            :source="form.input"
            :trigger-type="form.triggerType"
            :model-value="form.triggerParams ?? {}"
            @update:model-value="form.triggerParams = $event"
          />
        </div>
      </template>

      <!-- ── STEP 2 ─ Trigger (polling: condition editor / webhook: URL info) ── -->
      <template v-else-if="currentStepKey === 'trigger'">
        <template v-if="isPolling">
          <ConditionEditor
            :model-value="form.triggerParams?.condition"
            :url="form.triggerParams?.url"
            :format="form.triggerParams?.format"
            @update:model-value="form.triggerParams = { ...(form.triggerParams ?? {}), condition: $event }"
            @update:payload="lastPollPayload = $event"
          />
        </template>

        <template v-else-if="isWebhook">
          <p class="step-intro">
            <strong>{{ form.input }}</strong> uses a <strong>webhook</strong>.
            Nothing to configure here: a unique webhook URL will be generated
            once you save the alert, and you can paste it into the source's
            outgoing-webhook settings.
          </p>
          <div class="info-box">
            <span class="info-icon">ℹ</span>
            <div>
              <p class="info-title">Webhook URL</p>
              <p class="info-text">
                Will appear in this alert's view page after save.
              </p>
            </div>
          </div>
        </template>
      </template>

      <!-- ── STEP 3 ─ Bundles ──────────────────────────────────────── -->
      <template v-else-if="currentStepKey === 'bundle'">
        <p class="step-intro">
          A <strong>bundle</strong> is one notification target: a set of discussions
          plus a message format. 
        </p>

        <div class="bundles-grid">
          <BundleCard
            v-for="(b, i) in bundles"
            :key="i"
            :bundle="b"
            :index="i"
            :available-discussions="availableDiscussions"
            :discussions-loading="discussionsLoading"
            :input-source="form.input"
            :alert-context="form"
            :poll-payload="lastPollPayload"
            :trigger-params="form.triggerParams"
            @update:bundle="updateBundle(i, $event)"
            @remove="removeBundle(i)"
          />

          <button type="button" class="card-add" @click="addBundle">
            <span class="plus">+</span>
            <span>{{ bundles.length === 0 ? 'Start adding bundles' : 'New Bundle' }}</span>
          </button>
        </div>

        <p
          v-if="bundles.length > 0 && hasEmptyBundle"
          class="warn-hint"
        >
          ⚠ Some bundles have no discussions selected — this alert will be saved
          as a <strong>draft</strong> until every bundle has at least one
          discussion.
        </p>
      </template>

    </div>

    <!-- ── Footer ─ context-sensitive ────────────────────────────────
         Left cluster: step-back + Delete (lateral / destructive actions).
         Right cluster: save flow + forward action.
         Spacer in the middle keeps the destructive button visually
         separated from save buttons so it can't be mis-clicked.            -->
    <div class="panel-foot">
      <button
        v-if="currentStep > 1"
        type="button"
        class="btn btn-ghost"
        @click="back"
      >
        ← Back
      </button>
      <!--button
        v-if="isExisting"
        type="button"
        class="btn btn-danger-ghost"
        @click="confirmingDelete = true"
      >
        Delete
      </button-->
      <div class="foot-spacer" />

      <!-- Bundle step: final save lives here, primary CTA. -->
      <template v-if="isOnBundleStep">
        <ButtonPrimary :disabled="saving" @click="save(false, true)">
          {{ saving ? 'Saving…' :
             (effectiveFinalStatus === AlertStatus.Draft ? 'Save as draft' : 'Save alert') }}
        </ButtonPrimary>
      </template>

      <!-- Every other step: Save button adapts based on completeness.
           Complete  → primary "Save alert" that commits AND returns the
                       user to view mode (navigateAfter=true). Sits to the
                       left of Continue so the page reads left-to-right as
                       "commit OR keep editing".
           Incomplete → secondary "Save as draft", stays in the wizard
                        (navigateAfter=false) so the user can keep filling
                        the form. -->
      <template v-else>
        <ButtonPrimary
          v-if="wouldBeComplete"
          :disabled="saving"
          title="Save the alert and return to view mode"
          @click="save(false, true)"
        >
          {{ saving ? 'Saving…' : 'Save alert' }}
        </ButtonPrimary>
        <button
          v-else
          type="button"
          class="btn btn-secondary"
          :disabled="!canSaveDraft || saving"
          :title="canSaveDraft ? 'Save as draft and return to view mode' : 'Add a title to save'"
          @click="save(true, true)"
        >
          {{ saving ? 'Saving…' : 'Save as draft' }}
        </button>

        <ButtonPrimary
          v-if="isOnLastConfigStep"
          :disabled="!canAdvance || saving"
          @click="next"
        >
          Add bundles →
        </ButtonPrimary>
        <ButtonPrimary
          v-else
          :disabled="!canAdvance || saving"
          @click="next"
        >
          Continue →
        </ButtonPrimary>
      </template>
    </div>

    </div><!-- /.wizard -->

  </div>
</template>

<style scoped>
/* Most surfaces come from the global stylesheet (.panel / .panel-head /
 * .panel-body / .panel-foot / .field* / .btn* / .overlay* / .card-add).
 * Only wizard-specific layout/composition lives here.
 */

.wizard-root {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
}
.wizard.panel { flex: 1; }

/* Stepper rail above the panel. */
.wizard-stepper {
  padding: var(--space-2) var(--space-1);
  flex-shrink: 0;
}

/* Header composition: tag + title + draft badge on the left, Back on the right. */
.head-left { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; }
.head-tag {
  background: var(--color-border-subtle);
  color: var(--color-text-dim);
  font-size: var(--text-sm);
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
/* Title block — stacks the title and description so the layout matches
 * view mode exactly. The visible difference between view and edit is now
 * just the inputs themselves: same position, same size, same flow. */
.head-title-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}
/* Title row — title input expands, status badge sits to its right. */
.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

/* Title input — matches the view-mode .view-title at rest (same size,
 * weight, color, line-height). The interactive affordances appear only
 * on hover/focus: a faint background tint signals "click me", and a
 * dashed under-line signals "this is editable text". On focus, the
 * underline solidifies to the accent color. */
.title-input {
  flex: 1;
  min-width: 0;
  margin: 0;
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px dashed transparent;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: 1.2;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  transition: background-color .15s ease, border-bottom-color .15s ease;
}
.title-input::placeholder {
  color: var(--color-text-faint);
  font-weight: 600;
}
.title-input:hover:not(:focus) {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-border-default);
}
.title-input:focus {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-accent);
  border-bottom-style: solid;
}

/* Description input — sits under the title in the same block. Visually
 * matches view-mode .view-subtitle (muted, smaller, lighter weight) at
 * rest, with the same hover/focus affordances as the title. */
.description-input {
  margin: 0;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px dashed transparent;
  color: var(--color-text-muted);
  font-size: var(--text-base);
  font-weight: 400;
  line-height: 1.4;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-family: inherit;
  transition: background-color .15s ease, border-bottom-color .15s ease, color .15s ease;
}
.description-input::placeholder {
  color: var(--color-text-faint);
  font-style: italic;
}
.description-input:hover:not(:focus) {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-border-subtle);
  color: var(--color-text-secondary);
}
.description-input:focus {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-accent);
  border-bottom-style: solid;
  color: var(--color-text-primary);
}

/* Status badge — colour reflects the alert's current saved status. The
 * .draft variant keeps the original draft-badge styling. */
.status-badge {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  border: 1px solid transparent;
}
.status-badge.draft {
  background: var(--color-warning-soft);
  border-color: var(--color-warning-border);
  color: var(--color-warning-text);
}
.status-badge.inactive {
  background: var(--color-border-subtle);
  border-color: var(--color-border-default);
  color: var(--color-text-dim);
}
.status-badge.active {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
  color: var(--color-success-text);
}

/* Step-body callouts. */
.step-intro {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-base);
  line-height: 1.5;
}
.step-intro strong { color: var(--color-text-secondary); }

.field-hint strong { color: var(--color-accent-text); font-weight: 600; }

/* Bundles grid + warn hint on the bundle step. */
.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
}

.warn-hint {
  margin: 0;
  padding: var(--space-3) var(--space-5);
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-lg);
  color: var(--color-warning-text);
  font-size: var(--text-md);
  line-height: 1.5;
}
.warn-hint strong { color: var(--color-warning-bright); }

/* Webhook info card (Trigger step for webhook sources). */
.info-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
}
.info-icon  { color: var(--color-accent-text); font-size: var(--text-xl); line-height: 1; flex-shrink: 0; margin-top: 1px; }
.info-title { margin: 0 0 var(--space-1); color: var(--color-text-primary); font-size: var(--text-base); font-weight: 600; }
.info-text  { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); line-height: 1.4; }

/* Footer composition. */
.foot-spacer { flex: 1; }
</style>
