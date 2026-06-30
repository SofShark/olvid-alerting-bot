import { ref, computed, watch, type Ref } from "vue";
import { Source } from "#shared/types/source";
import { ConditionKind } from "#shared/types/condition";
import type { AlertModel } from "#shared/types/alert";

export type WizardStepKey = "general" | "trigger" | "bundle";
export type WizardStepDef = {
  key: WizardStepKey;
  title: string;
  description: string;
  disabled: boolean;
};

/**
 * Step state-machine for AlertWizard. Polling alerts have 3 steps
 * (general → trigger condition → bundles); webhook alerts have 2 (general → bundles).
 *
 * Completeness gates:
 *   - `isStep1Complete` — source picked + polling-cfg fields filled (webhook auto-passes)
 *   - `isConditionComplete` — kind=None passes; kind=Rule requires ≥1 path + (value if needed)
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

  const isPollingConfigComplete = computed(() => {
    if (!isPolling.value) return true;
    const p = (form.value.alertParams ?? {}) as any;
    return !!p.url && !!p.format && !!p.schedule;
  });

  const isStep1Complete = computed(
    () => !!form.value.input && isPollingConfigComplete.value,
  );

  const isConditionComplete = computed(() => {
    if (!isPolling.value) return true;
    const c = ((form.value.alertParams as any)?.condition ?? {}) as any;
    if (c.kind === ConditionKind.None) return true;
    if (c.kind === ConditionKind.Rule) {
      if (!Array.isArray(c.paths) || c.paths.length === 0) return false;
      if (c.operator && c.operator !== "changed" && !c.value) return false;
      return true;
    }
    return false;
  });

  const stepDefs = computed<WizardStepDef[]>(() => {
    const general: WizardStepDef = {
      key: "general",
      title: t("wizard.steps.general.title"),
      description: isPolling.value
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
      disabled: !isStep1Complete.value || !isConditionComplete.value,
    };
    return isPolling.value ? [general, trigger, bundle] : [general, bundle];
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
        return isConditionComplete.value;
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
    isPollingConfigComplete,
    isConditionComplete,
    next,
    back,
  };
};
