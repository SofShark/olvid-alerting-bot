import { computed } from "vue";
import { TriggerMode } from "#shared/types/polling";

/*
  Single source of truth for the TriggerMode enum's user-facing labels
  and hints. Consumed by:

    · ui/TriggerModePicker.vue   → the editable <select> shown in the
                                    polling & monitoring trigger steps.
    · view/AlertInputSummary.vue → the read-only row rendered in view
                                    mode.

  Labels reactively re-translate on locale change (computed over the i18n
  `t` function). The `hint` variants live under `wizard.triggerMode.hints`
  and differ slightly between polling and monitoring — pick which set via
  the optional `variant` argument. Default is `"polling"` (kept as the
  default because polling was the original consumer).

  Boundary: this composable owns the enum ↔ i18n mapping. Nothing else
  in the codebase should hardcode a TriggerMode label.
*/

type Variant = "polling" | "monitoring";

export const useTriggerModeOptions = (variant: Variant = "polling") => {
  const { t } = useI18n();

  const labelFor = (mode: TriggerMode): string =>
    t(`wizard.triggerMode.labels.${mode}`);

  const hintFor = (mode: TriggerMode): string =>
    t(`wizard.triggerMode.hints.${variant}.${mode}`);

  const options = computed<Array<{ value: TriggerMode; label: string; hint: string }>>(
    () => [
      { value: TriggerMode.EveryTime, label: labelFor(TriggerMode.EveryTime), hint: hintFor(TriggerMode.EveryTime) },
      { value: TriggerMode.OneShot, label: labelFor(TriggerMode.OneShot), hint: hintFor(TriggerMode.OneShot) },
      { value: TriggerMode.WithRecovery, label: labelFor(TriggerMode.WithRecovery), hint: hintFor(TriggerMode.WithRecovery) },
    ],
  );

  return { options, labelFor, hintFor };
};
