<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { alertService } from '~/utils/alertService';

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

    <div v-if="showDiscardWarning" class="overlay">
      <div class="overlay-box">
        <h4>Discard new alert?</h4>
        <p>You have unsaved input. Leaving now will lose it.</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-ghost" @click="showDiscardWarning = false">Continue editing</button>
          <button type="button" class="btn btn-danger" @click="discardAndExit">Discard</button>
        </div>
      </div>
    </div>

    <!-- Stepper sits ABOVE the creation card -->
    <div class="wizard-stepper">
      <Stepper v-model="currentStep" :steps="stepDefs" />
    </div>

    <div class="panel wizard">

    <div class="panel-head">
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
      <button type="button" class="btn btn-ghost" @click="requestBack">← Back to list</button>
    </div>

    <div class="panel-body">

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

    <!-- ── Footer ─ context-sensitive ──────────────────────────────── -->
    <div class="panel-foot">
      <button
        v-if="currentStep > 1"
        type="button"
        class="btn btn-ghost"
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
          class="btn btn-secondary"
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
.title-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: 600;
  padding: var(--space-1) 2px;
}
.title-input:focus { outline: none; border-bottom-color: var(--color-accent); }
.title-input::placeholder { color: var(--color-text-faint); }

.draft-badge {
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning-text);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
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
