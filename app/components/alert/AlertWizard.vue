<script setup lang="ts">
import { computed, toRef } from "vue";
import { AlertStatus, type AlertModel } from "#shared/types/alert";
import { compactCondition, migrateCondition } from "#shared/condition/migrate";
import { getErrorMessage, getErrorData } from "~/utils/errors";

/*
  Orchestration container for the alert create / edit flow. Owns no UI
  semantics beyond layout: every visual region is a leaf component,
  every imperative concern is a composable.

      ┌─ Topbar (back-link + Stepper) ─────────────── inline here
      ├─ Step content — one of:
      │     general  → wizard/steps/StepGeneral   (owns title + description
      │                                             + source + params)
      │     trigger  → wizard/steps/StepTrigger   (polling / monitoring)
      │     bundle   → wizard/steps/StepBundles
      └─ Footbar (Back / Save-as-draft / Continue / Save) — AlertWizardFooter


  Composables called:
    - useAlertForm     → form + bundle helpers + isExisting/isPolling/isWebhook
    - useAlertActions  → save + saving flag
    - useDirtyGuard    → snapshot + isDirty + route guards + beforeunload
    - useWizardSteps   → stepDefs + canAdvance + step navigation
*/

const props = withDefaults(
  defineProps<{
    alertaInicial?: AlertModel | null;
  }>(),
  {
    alertaInicial: null,
  },
);

const { t } = useI18n();

const { availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts();

const { form, isExisting, isPolling, hasEmptyBundle } = useAlertForm(
  toRef(props, "alertaInicial"),
);

const { saving, saveAlert } = useAlertActions();

const {
  isDirty,
  showDiscardPrompt,
  pendingLeave,
  takeSnapshot,
  allowNextLeave,
  dismissPrompt,
} = useDirtyGuard(form);

const {
  currentStep,
  stepDefs,
  currentStepKey,
  canAdvance,
  isOnBundleStep,
  isOnLastConfigStep,
  isPollingConfigComplete,
  isConditionComplete,
  next,
  back,
} = useWizardSteps(form);

// Last parsed payload from ConditionEditor — piped into the bundle
// dialog's polling-default preview on the bundles step. Not persisted.
const lastPollPayload = ref<any>(null);

// ── Save semantics ────────────────────────────────────────────────────────
const canSaveDraft = computed(() => !!form.value.title);

// Final status the alert SHOULD have after save (modulo the explicit
// "save as draft" button which forces Draft).
const wouldBeComplete = computed(
  () =>
    !!form.value.title &&
    !!form.value.input &&
    isPollingConfigComplete.value &&
    isConditionComplete.value &&
    form.value.bundles.length > 0 &&
    !hasEmptyBundle.value,
);
const effectiveFinalStatus = computed<AlertStatus>(() => {
  if (!wouldBeComplete.value) return AlertStatus.Draft;
  if (isExisting.value && form.value.status === AlertStatus.Active) {
    return AlertStatus.Active;
  }
  // TODO determine whether newly-created alerts should auto-activate.
  return AlertStatus.Inactive;
});

const buildPayload = (status: AlertStatus) => {
  // Compact the polling condition on the way out: drop unused fields for
  // kind=None, drop `value` for operators that don't use it. During edition, memory shape
  // preserves all fields so the user can flip modes without losing context.
  const ap: any = { ...(form.value.alertParams ?? {}) };
  if (isPolling.value && ap.condition) {
    ap.condition = compactCondition(migrateCondition(ap.condition));
  }
  return {
    id: form.value.id,
    title: form.value.title,
    description: form.value.description,
    input: form.value.input,
    status,
    alertParams: ap,
    bundles: form.value.bundles.map((b) => ({
      id: b.id,
      name: b.name,
      formating: b.formating,
      custom_script: b.custom_script,
      outputs: b.outputs,
    })),
  };
};

const save = async (forceDraft: boolean, navigateAfter: boolean) => {
  if (!form.value.title) {
    alert(t("wizard.validation.titleMandatory"));
    return;
  }
  const status = forceDraft ? AlertStatus.Draft : effectiveFinalStatus.value;
  try {
    const saved = await saveAlert(buildPayload(status), {
      isExisting: isExisting.value,
    });
    if (saved) {
      form.value.id = saved.id ?? form.value.id;
      form.value.status = saved.status ?? form.value.status;
      form.value.token = saved.token ?? form.value.token;
      const savedBundles: any[] = (saved as any).bundles ?? [];
      form.value.bundles = form.value.bundles.map((b, i) => ({
        ...b,
        id: savedBundles[i]?.id ?? b.id,
      }));
      takeSnapshot(); // clean baseline after a successful persist
    }
    await fetchAlerts();
    if (navigateAfter && form.value.id) {
      allowNextLeave();
      await navigateTo("/alerts/" + form.value.id);
    }
  } catch (error: any) {
    console.error("Error saving:", getErrorData(error) ?? error);
    alert(
      `${t("wizard.errors.saving")}\n\n${getErrorMessage(error, t("common.unknownError"))}`,
    );
  }
};

// ── Back-to-list / discard flow ───────────────────────────────────────────
const onBackToList = () => {
  if (isDirty.value) {
    showDiscardPrompt.value = true;
  } else {
    navigateTo("/");
  }
};
const onDiscard = () => {
  showDiscardPrompt.value = false;
  const target = pendingLeave.value;
  pendingLeave.value = null;
  allowNextLeave();
  navigateTo(target ?? "/");
};
const onSaveDraftAndLeave = async () => {
  await save(true, false);
  if (!form.value.id) return; // save failed — keep the prompt up
  showDiscardPrompt.value = false;
  const target = pendingLeave.value;
  pendingLeave.value = null;
  allowNextLeave();
  navigateTo(target ?? "/alerts/" + form.value.id);
};
</script>

<template>
  <div class="wizard-root">
    <DiscardChangesDialog
      :open="showDiscardPrompt"
      :can-save-draft="canSaveDraft"
      :saving="saving"
      @save-draft="onSaveDraftAndLeave"
      @continue-editing="dismissPrompt"
      @discard="onDiscard"
    />

    <!-- Topbar — one thin row: back-link on the left, stepper on the right.
         Replaces the old grey-strip masthead that was mimicking view mode. -->
    <div class="wizard-topbar">
      <button
        type="button"
        class="btn btn-ghost btn-sm topbar-back"
        @click="onBackToList"
      >
        🡐 {{ $t("button.backToList") }}
      </button>
      <div class="topbar-stepper">
        <Stepper v-model="currentStep" :steps="stepDefs" />
      </div>
    </div>

    <!-- Step content — no `.panel` wrapper. Content sits on the app
         background with a max-width for readability. -->
    <div class="wizard-content">
      <StepGeneral v-if="currentStepKey === 'general'" v-model="form" />
      <StepTrigger
        v-else-if="currentStepKey === 'trigger'"
        v-model="form"
        @update:payload="lastPollPayload = $event"
      />
      <StepBundles
        v-else-if="currentStepKey === 'bundle'"
        v-model="form"
        :available-discussions="availableDiscussions"
        :discussions-loading="discussionsLoading"
        :poll-payload="lastPollPayload"
      />
    </div>

    <AlertWizardFooter
      :show-back="currentStep > 1"
      :saving="saving"
      :is-on-bundle-step="isOnBundleStep"
      :is-on-last-config-step="isOnLastConfigStep"
      :can-advance="canAdvance"
      :can-save-draft="canSaveDraft"
      :would-be-complete="wouldBeComplete"
      :effective-final-status="effectiveFinalStatus"
      @back="back"
      @next="next"
      @save="save(false, true)"
      @save-draft="save(true, true)"
    />
  </div>
</template>

<style scoped>
/* Flow-first layout: topbar (thin) + content (scrolls) + footbar (thin).
 * Deliberately no card/panel wrapping — the app's grey nav on the left
 * already provides all the chrome the eye needs, and the previous
 * `.panel` shell was eating ~130px of vertical space + ambient noise. */
.wizard-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg-app);
}

.wizard-topbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: 0 var(--space-8) var(--space-2) var(--space-8) ;
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}
.topbar-back {
  flex-shrink: 0;
}
.topbar-stepper {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.wizard-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-8);
}
.wizard-content > * {
  /* Keep line lengths readable on wide screens without capping too
   * hard on narrow ones. */
  max-width: 800px;
  margin: 0 auto;
}
</style>
