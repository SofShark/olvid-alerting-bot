<script setup lang="ts">
import { computed } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import { TriggerMode, type PollingParams } from "#shared/types/polling";
import type { MonitorParams } from "#shared/types/monitor";
import { ConditionKind, ConditionOperator } from "#shared/types/condition";

/*
  Step 2: source-specific trigger configuration. Uniform layout for
  both source types:

    · Polling    → ConditionEditor  (watch paths + rule row)
    · Monitoring → StatusMatchEditor (status match kind + kind-body)
    · FiringBehaviorPanel (shared)   → trigger mode + datapoints mockup

  The FiringBehaviorPanel is source-agnostic — it renders identically
  for polling and monitoring, so the user sees the same "firing
  behavior" block at the bottom of the step regardless of source.
  Only the `variant` prop changes the hint wording.

  Webhook alerts skip this step entirely (useWizardSteps handles it).

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

// Firing-behavior visibility gates:
//
//   showFiringBehavior — whole panel. Hidden when the condition is
//     kind=None: an every-poll alert has nothing to modulate, so
//     neither trigger mode nor datapoints make sense there.
//     Monitoring always shows the panel (no None option there).
//
//   showTriggerMode — the trigger-mode row inside the panel. Also
//     hidden when operator=Changed: each change IS itself a discrete
//     event, so the mode is redundant. Datapoints stays visible in
//     that case ("fire after N consecutive changes" is still valid).
const showFiringBehavior = computed(() => {
  if (isMonitoring.value) return true;
  return condition.value?.kind === ConditionKind.Rule;
});
const showTriggerMode = computed(() => {
  if (isMonitoring.value) return true;
  const c = condition.value;
  return (
    c?.kind === ConditionKind.Rule && c.operator !== ConditionOperator.Changed
  );
});

// v-model target for FiringBehaviorPanel's trigger mode — reads/writes
// alertParams.triggerMode for whichever source is active.
const triggerModeModel = computed<TriggerMode>({
  get: () =>
    (form.value.alertParams as PollingParams | MonitorParams | undefined)
      ?.triggerMode ?? TriggerMode.EveryTime,
  set: (v) => {
    if (!form.value.alertParams) return;
    form.value.alertParams = { ...form.value.alertParams, triggerMode: v };
  },
});

const behaviorVariant = computed<"polling" | "monitoring">(() =>
  isMonitoring.value ? "monitoring" : "polling",
);
</script>

<template>
  <div class="step-trigger">
    <!-- Source-specific: WHAT counts as a match. -->
    <template v-if="isPolling">
      <ConditionEditor
        :model-value="condition"
        :url="(form.alertParams as PollingParams | undefined)?.url"
        :format="(form.alertParams as PollingParams | undefined)?.format"
        @update:model-value="condition = $event"
        @update:payload="$emit('update:payload', $event)"
      />
    </template>
    <template v-else-if="isMonitoring">
      <StatusMatchEditor v-model="form" />
    </template>

    <!-- Source-agnostic: WHEN a match actually notifies. Same panel
         for both polling and monitoring — variant only affects hint copy.
         Hidden entirely when the polling condition is kind=None (every-poll
         alerts have nothing to modulate). -->
    <FiringBehaviorPanel
      v-if="showFiringBehavior"
      v-model="triggerModeModel"
      :variant="behaviorVariant"
      :show-trigger-mode="showTriggerMode"
    />
  </div>
</template>

<style scoped>
.step-trigger {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
</style>
