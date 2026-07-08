import { ref, computed, watch, type Ref } from "vue";
import { Source } from "#shared/types/source";
import { ConditionKind } from "#shared/types/condition";
import type { AlertModel } from "#shared/types/alert";
import type { MonitorParams } from "#shared/types/monitor";
import { isStatusMatchValid } from "#shared/polling/matcher";

export type WizardStepKey = "general" | "trigger" | "bundle";
export type WizardStepDef = {
  key: WizardStepKey;
  title: string;
  description: string;
  disabled: boolean;
};

/**
 * Step state-machine for AlertWizard.
 *
 * Two step counts by source:
 *   - Polling / Monitoring → 3 steps (general → trigger → bundles).
 *   - Webhook               → 2 steps (general → bundles); the trigger
 *                             step is skipped because webhooks fire on
 *                             every valid POST.
 *
 * Completeness gates:
 *   - `isStep1Complete`  → source picked AND its params filled
 *                          (per-source rules below; webhook auto-passes).
 *   - `isTriggerComplete` → per-source trigger validation
 *                          (PollingCondition well-formed OR StatusMatch
 *                          well-formed; webhook auto-passes).
 *
 * `canAdvance` is the gate for the "Continue" button in the footer. The
 * "Bundles" step has no gate — the save handler decides draft-vs-active.
 *
 * `currentStep` is exposed as a ref so the consumer can `v-model` it on Stepper.
 */
export const useWizardSteps = (form: Ref<AlertModel>) => {
  const { t } = useI18n();

  const currentStep = ref(1);

  const isPolling = computed(() => form.value.input === Source.Polling);
  const isMonitoring = computed(() => form.value.input === Source.Monitoring);
  /** True when the source drives a trigger step (Polling / Monitoring).
   *  Webhook skips the trigger step entirely. */
  const hasTriggerStep = computed(() => isPolling.value || isMonitoring.value);

  // Per-source "step 1 params are usable" checks — kept together so
  // adding a new scheduled source is one arm here + one in isTriggerComplete.
  const isPollingConfigComplete = computed(() => {
    const p = (form.value.alertParams ?? {}) as any;
    return !!p.url && !!p.format && !!p.schedule;
  });
  const isMonitorConfigComplete = computed(() => {
    const p = (form.value.alertParams ?? {}) as any;
    return !!p.url && !!p.schedule;
  });

  const isSourceConfigComplete = computed(() => {
    if (isPolling.value) return isPollingConfigComplete.value;
    if (isMonitoring.value) return isMonitorConfigComplete.value;
    return true; // Webhook has no source-side config.
  });

  const isStep1Complete = computed(
    () => !!form.value.input && isSourceConfigComplete.value,
  );

  const isTriggerComplete = computed(() => {
    if (isPolling.value) {
      const c = ((form.value.alertParams as any)?.condition ?? {}) as any;
      if (c.kind === ConditionKind.None) return true;
      if (c.kind === ConditionKind.Rule) {
        if (!Array.isArray(c.paths) || c.paths.length === 0) return false;
        if (c.operator && c.operator !== "changed" && !c.value) return false;
        return true;
      }
      return false;
    }
    if (isMonitoring.value) {
      const p = form.value.alertParams as MonitorParams | undefined;
      return isStatusMatchValid(p?.match);
    }
    return true; // Webhook: no trigger validation.
  });

  const stepDefs = computed<WizardStepDef[]>(() => {
    const general: WizardStepDef = {
      key: "general",
      title: t("wizard.steps.general.title"),
      description: hasTriggerStep.value
        ? t("wizard.steps.general.descriptionPolling")
        : t("wizard.steps.general.descriptionWebhook"),
      disabled: false,
    };
    const trigger: WizardStepDef = {
      key: "trigger",
      title: t("wizard.steps.trigger.title"),
      description: t("wizard.steps.trigger.description"),
      disabled: !isStep1Complete.value,
    };
    const bundle: WizardStepDef = {
      key: "bundle",
      title: t("wizard.steps.bundle.title"),
      description: t("wizard.steps.bundle.description"),
      disabled: !isStep1Complete.value || !isTriggerComplete.value,
    };
    return hasTriggerStep.value
      ? [general, trigger, bundle]
      : [general, bundle];
  });

  const currentStepKey = computed<WizardStepKey>(
    () => stepDefs.value[currentStep.value - 1]?.key ?? "general",
  );

  // Clamp when the step list shrinks (e.g. polling → webhook drops the trigger step).
  watch(stepDefs, (defs) => {
    if (currentStep.value > defs.length) currentStep.value = defs.length;
  });

  const isOnBundleStep = computed(() => currentStepKey.value === "bundle");
  const isOnLastConfigStep = computed(() => {
    const bundleIndex = stepDefs.value.findIndex((d) => d.key === "bundle");
    return currentStep.value === bundleIndex;
  });

  const canAdvance = computed(() => {
    switch (currentStepKey.value) {
      case "general":
        return isStep1Complete.value;
      case "trigger":
        return isTriggerComplete.value;
      default:
        return false;
    }
  });

  const next = () => {
    if (!canAdvance.value) return;
    if (currentStep.value < stepDefs.value.length) currentStep.value++;
  };
  const back = () => {
    if (currentStep.value > 1) currentStep.value--;
  };

  return {
    currentStep,
    stepDefs,
    currentStepKey,
    canAdvance,
    isOnBundleStep,
    isOnLastConfigStep,
    // Source-agnostic completeness gates. Old names
    // (`isPollingConfigComplete` / `isConditionComplete`) kept as aliases
    // so the wizard's `wouldBeComplete` computation keeps working
    // without a rewrite.
    isSourceConfigComplete,
    isTriggerComplete,
    isPollingConfigComplete: isSourceConfigComplete,
    isConditionComplete: isTriggerComplete,
    next,
    back,
  };
};
