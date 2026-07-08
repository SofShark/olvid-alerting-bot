<script setup lang="ts">
import { computed } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import { TriggerMode, type PollingParams } from "#shared/types/polling";
import {
  ConditionKind,
  ConditionOperator,
} from "#shared/types/condition";

/*
  Step 2: source-specific trigger configuration.
    - Polling    → ConditionEditor over paths + operator + value, plus
                   the TriggerMode picker (hidden for edge-native cases).
    - Monitoring → StatusMatchEditor over HTTP codes / range / not-ok,
                   with its own TriggerMode picker embedded.
    - Webhook    → this step is not reached (useWizardSteps skips it).

  Trigger mode for polling lives here (not in TriggerParamsEditor / Step 1)
  because the gate "only meaningful when condition.kind=Rule and
  operator!=Changed" needs the user to have actually shaped the condition
  first.

  Re-emits `update:payload` upward so the wizard can pipe the parsed
  payload into the bundle dialog's preview on step 3.
*/

const form = defineModel<AlertModel>({ required: true });

defineEmits<{ (e: "update:payload", v: any): void }>();

const isPolling = computed(() => form.value.input === Source.Polling);
const isMonitoring = computed(() => form.value.input === Source.Monitoring);

const condition = computed({
  get: () => (form.value.alertParams as PollingParams | undefined)?.condition,
  set: (v) => {
    if (!form.value.alertParams || !v) return;
    form.value.alertParams = { ...form.value.alertParams, condition: v };
  },
});

// ── Trigger mode ───────────────────────────────────────────────────────────
// Edge-native conditions (kind=None, operator=Changed) already fire on
// transitions by design — the trigger mode picker doesn't apply to them.
const showTriggerMode = computed(
  () =>
    condition.value?.kind === ConditionKind.Rule &&
    condition.value.operator !== ConditionOperator.Changed,
);

const selectedTriggerMode = computed<TriggerMode>(
  () =>
    (form.value.alertParams as PollingParams | undefined)?.triggerMode ??
    TriggerMode.EveryTime,
);

const TRIGGER_MODE_OPTIONS: Array<{
  value: TriggerMode;
  label: string;
  hint: string;
}> = [
  {
    value: TriggerMode.EveryTime,
    label: "Every time",
    hint: "Fire on every poll while the condition is met.",
  },
  {
    value: TriggerMode.OneShot,
    label: "Once",
    hint: "Fire only on the first poll where the condition becomes true.",
  },
  {
    value: TriggerMode.WithRecovery,
    label: "Once + on recovery",
    hint: "Fire once, then again when the condition no longer holds.",
  },
];

const onTriggerModeChange = (v: string) => {
  if (!form.value.alertParams) return;
  form.value.alertParams = {
    ...form.value.alertParams,
    triggerMode: v as TriggerMode,
  };
};

const triggerModeHint = computed(
  () =>
    TRIGGER_MODE_OPTIONS.find((o) => o.value === selectedTriggerMode.value)
      ?.hint,
);
</script>

<template>
  <div class="step-trigger">
    <!-- Polling: condition over parsed body + trigger-mode picker. -->
    <template v-if="isPolling">
      <ConditionEditor
        :model-value="condition"
        :url="(form.alertParams as PollingParams | undefined)?.url"
        :format="(form.alertParams as PollingParams | undefined)?.format"
        @update:model-value="condition = $event"
        @update:payload="$emit('update:payload', $event)"
      />

      <div v-if="showTriggerMode" class="field trigger-mode-field">
        <label class="field-label">Trigger mode</label>
        <select
          :value="selectedTriggerMode"
          class="field-input"
          @change="onTriggerModeChange(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="opt in TRIGGER_MODE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <span class="field-hint">{{ triggerModeHint }}</span>
      </div>
    </template>

    <!-- Monitoring: status-match editor + its own trigger-mode picker
         (embedded — status alerts always have a meaningful mode). -->
    <template v-else-if="isMonitoring">
      <StatusMatchEditor v-model="form" />
    </template>
  </div>
</template>

<style scoped>
.step-trigger {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.trigger-mode-field {
  /* Sits below the ConditionEditor — visually grouped with it via the
   * parent column gap, no extra surface needed. */
  max-width: 420px;
}
</style>
