<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BundleCard from './BundleCard.vue'
import ConditionEditor from './ConditionEditor.vue'
import {
  Formatting,
  AlertStatus,
  Trigger,
  ConditionKind,
  PollingFormat,
  isPollingSource,
  sourceTriggers,
  type AlertModel,
  type BundleModel,
  type DiscussionModel,
} from '#shared/constants'

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
}>(), {
  alertaInicial: null,
})

const { availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts()

const currentStep = ref(1)
const saving = ref(false)
const showDiscardWarning = ref(false)

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

const canSaveWithoutBundle = computed(
  () => isStep1Complete.value && isConditionComplete.value,
)

// ── Navigation ────────────────────────────────────────────────────────────
const hasAnyInput = computed(
  () =>
    !!form.value.title ||
    !!form.value.description ||
    !!form.value.input ||
    bundles.value.length > 0,
)

const requestBack = () => {
  if (hasAnyInput.value) showDiscardWarning.value = true
  else navigateTo('/')
}

const discardAndExit = () => {
  showDiscardWarning.value = false
  navigateTo('/')
}

const next = () => {
  if (!canAdvance.value) return
  if (currentStep.value < stepDefs.value.length) currentStep.value++
}

const back = () => {
  if (currentStep.value > 1) currentStep.value--
}

// ── Persistence ───────────────────────────────────────────────────────────
const buildPayload = (status: AlertStatus) => ({
  id: form.value.id,
  title: form.value.title,
  description: form.value.description,
  input: form.value.input,
  triggerType: form.value.triggerType,
  status,
  triggerParams: form.value.triggerParams ?? {},
  bundles: bundles.value.map(b => ({
    id: b.id,
    name: b.name,
    formating: b.formating,
    custom_script: b.custom_script,
    discussion_list: b.discussion_list.map(d => d.id),
  })),
})

const canSaveDraft = computed(() => !!form.value.title)

// The final "Save alert" downgrades to Draft when the bundles are incomplete:
// an empty bundle (no discussions) can't actually notify anyone, so the alert
// isn't ready to be Inactive.
const effectiveFinalStatus = computed<AlertStatus>(() => {
  if (bundles.value.length === 0) return AlertStatus.Draft
  if (hasEmptyBundle.value) return AlertStatus.Draft
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

    <div v-if="showDiscardWarning" class="confirm-overlay">
      <div class="confirm-box">
        <h4>Discard new alert?</h4>
        <p>You have unsaved input. Leaving now will lose it.</p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="showDiscardWarning = false">Continue editing</button>
          <button type="button" class="btn-danger" @click="discardAndExit">Discard</button>
        </div>
      </div>
    </div>

    <!-- Stepper sits ABOVE the creation card -->
    <div class="wizard-stepper">
      <Stepper v-model="currentStep" :steps="stepDefs" />
    </div>

    <div class="wizard">

    <div class="wizard-head">
      <div class="head-left">
        <span class="head-tag">{{ isExisting ? `#${form.id}` : 'NEW' }}</span>
        <input
          v-model="form.title"
          type="text"
          placeholder="Alert title…"
          class="title-input"
        />
        <span v-if="isExisting" class="draft-badge">DRAFT</span>
      </div>
      <button type="button" class="btn-ghost" @click="requestBack">← Back to list</button>
    </div>

    <div class="wizard-body">

      <!-- ── STEP 1 ─ General (title + description + source + inline polling cfg) ── -->
      <template v-if="currentStepKey === 'general'">
        <div class="field">
          <label class="field-label">Description</label>
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="What does this alert do?"
            class="field-input"
          />
        </div>

        <div class="field">
          <label class="field-label">Input Source <span class="req">*</span></label>
          <InputSourceSelector v-model="form.input" />
          <p v-if="form.triggerType" class="field-hint">
            Communication: <strong>{{ form.triggerType }}</strong>
            — how this source talks to the alert system.
          </p>
        </div>

        <!-- Polling sources expose URL / format / timing inline. -->
        <div v-if="isPolling" class="field">
          <label class="field-label">Polling configuration <span class="req">*</span></label>
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
          plus a message format. Add one or more — bundles without any
          discussions keep the alert in draft state.
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

          <button type="button" class="new-bundle" @click="addBundle">
            <span class="nb-plus">+</span>
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

    <!-- ── Footer ─ context-sensitive ──────────────────────────────── -->
    <div class="wizard-foot">
      <button
        v-if="currentStep > 1"
        type="button"
        class="btn-ghost"
        @click="back"
      >
        ← Back
      </button>
      <div class="foot-spacer" />

      <!-- Bundle step: final save. Status auto-downgrades to draft if any
           bundle is missing discussions. -->
      <template v-if="isOnBundleStep">
        <ButtonPrimary :disabled="saving" @click="save(false, true)">
          {{ saving ? 'Saving…' :
             (effectiveFinalStatus === AlertStatus.Draft ? 'Save as draft' : 'Save alert') }}
        </ButtonPrimary>
      </template>

      <!-- Every other step (general / config / condition): save as draft is
           always offered, plus the appropriate forward action. -->
      <template v-else>
        <button
          type="button"
          class="btn-secondary"
          :disabled="!canSaveDraft || saving"
          :title="canSaveDraft ? 'Save the alert as a draft and stay here' : 'Add a title to save'"
          @click="save(true, false)"
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
.wizard-root {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.wizard {
  display: flex;
  flex-direction: column;
  background: #1d242e;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────── */
.wizard-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}
.head-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.head-tag {
  background: #1e293b;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.title-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: #f1f5f9;
  font-size: 18px;
  font-weight: 600;
  padding: 4px 2px;
}
.title-input:focus { outline: none; border-bottom-color: #3b82f6; }
.title-input::placeholder { color: #475569; }

.draft-badge {
  background: #422006;
  border: 1px solid #92400e;
  color: #fbbf24;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* ── Stepper rail (above the creation card) ─────── */
.wizard-stepper {
  padding: 6px 4px;
  flex-shrink: 0;
}

/* ── Body ───────────────────────────────────────── */
.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.step-intro {
  margin: 0 0 4px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}
.step-intro strong { color: #cbd5e1; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.field-hint {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
.field-hint strong { color: #93c5fd; font-weight: 600; }
.req { color: #ef4444; }
.field-input {
  padding: 9px 12px;
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid #1e293b;
  border-radius: 5px;
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.field-input:focus { outline: none; border-color: #3b82f6; }
.field-input::placeholder { color: #334155; }

/* ── Bundles grid (bundle step) ────────────────── */
.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.new-bundle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  background: transparent;
  border: 1px dashed #334155;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.new-bundle:hover { border-color: #3b82f6; color: #93c5fd; background: #0f172a; }
.nb-plus { font-size: 28px; line-height: 1; }

.warn-hint {
  margin: 0;
  padding: 10px 14px;
  background: #422006;
  border: 1px solid #92400e;
  border-radius: 6px;
  color: #fbbf24;
  font-size: 12px;
  line-height: 1.5;
}
.warn-hint strong { color: #fde68a; }

/* ── Info box (webhook step) ───────────────────── */
.info-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #0f2744;
  border: 1px solid #1e40af;
  border-radius: 6px;
  padding: 14px 16px;
}
.info-icon { color: #93c5fd; font-size: 18px; line-height: 1; flex-shrink: 0; margin-top: 1px; }
.info-title { margin: 0 0 4px; color: #f1f5f9; font-size: 13px; font-weight: 600; }
.info-text  { margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.4; }

/* ── Footer ─────────────────────────────────────── */
.wizard-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #1e293b;
  border-top: 1px solid #1e293b;
}
.foot-spacer { flex: 1; }

.btn-ghost {
  background: transparent;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.btn-ghost:hover { background: #1e293b; color: #f1f5f9; }

.btn-secondary {
  background: #0f172a;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.btn-secondary:hover:not(:disabled) { background: #1e293b; border-color: #475569; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Confirm overlay ────────────────────────────── */
.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.confirm-box {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 24px;
  max-width: 360px;
}
.confirm-box h4 { margin: 0 0 8px; color: #f1f5f9; font-size: 16px; }
.confirm-box p { margin: 0 0 18px; color: #94a3b8; font-size: 13px; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-danger {
  background: #dc2626;
  color: #fff;
  border: 1px solid #b91c1c;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.btn-danger:hover { background: #b91c1c; }
</style>
