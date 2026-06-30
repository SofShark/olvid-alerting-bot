<script setup lang="ts">
import { computed } from "vue";
import { Source } from "#shared/types/source";
import {
  TriggerMode,
  type PollingParams,
} from "#shared/types/polling";
import {
  ConditionKind,
  ConditionOperator,
} from "#shared/types/condition";

/*
  INPUT block in view mode. Renders the alert's source-side configuration:
    - Webhook → just the endpoint URL.
    - Polling → URL, format · interval, condition summary.

  Layout-only — delegates the condition row to AlertConditionSummary.
  Interval label comes from useIntervalLabel so the wording matches the
  wizard's UI.
*/

const props = defineProps<{
  inputTitle: string; //TODO deprecated
  source: string;
  alertParams?: PollingParams;
  webhookUrl?: string;
}>();

const { scheduleLabel } = useScheduleLabel();

const isPolling = computed(() => props.source === Source.Polling);
const isWebhook = computed(() => props.source === Source.Webhook);

const pollingInterval = computed(() =>
  scheduleLabel(props.alertParams?.schedule),
);

// Trigger-mode row only renders when it's meaningful — edge-native conditions
// (kind=None, operator=Changed) ignore the mode in the engine, so showing it
// would lie. Matches the gating logic in TriggerParamsEditor.
const triggerModeMeaningful = computed(() => {
  const c = props.alertParams?.condition;
  return (
    c?.kind === ConditionKind.Rule &&
    c.operator !== ConditionOperator.Changed
  );
});

const triggerModeLabel = computed(() => {
  switch (props.alertParams?.triggerMode ?? TriggerMode.EveryTime) {
    case TriggerMode.OneShot:      return "Once";
    case TriggerMode.WithRecovery: return "Once + on recovery";
    default:                       return "Every time";
  }
});
</script>

<template>
  <div class="data-block">
    <h4 class="section-eyebrow">Configuration</h4>

    <dl class="data-grid">
      <template v-if="isWebhook">
        <div v-if="webhookUrl" class="data-row">
          <dt class="data-label">{{ $t("editor.view.fields.endpoint") }}</dt>
          <dd class="data-value">
            <URLCopyBox :url="webhookUrl" />
          </dd>
        </div>
      </template>

      <template v-else-if="isPolling">
        <div class="data-row">
          <dt class="data-label">{{ $t("editor.view.fields.url") }}</dt>
          <dd class="data-value">
            <URLCopyBox :url="alertParams?.url || '——'" />
          </dd>
        </div>
        <div class="data-row">
          <dt class="data-label">{{ $t("editor.view.fields.polling") }}</dt>
          <dd class="data-value">
            {{ alertParams?.format || $t("editor.interval.empty") }}
            <span class="dim">· {{ pollingInterval }}</span>
          </dd>
        </div>
        <div class="data-row">
          <dt class="data-label">{{ $t("editor.view.fields.condition") }}</dt>
          <dd class="data-value">
            <AlertConditionSummary :condition="alertParams?.condition" />
          </dd>
        </div>
        <div v-if="triggerModeMeaningful" class="data-row">
          <dt class="data-label">Trigger</dt>
          <dd class="data-value">{{ triggerModeLabel }}</dd>
        </div>
      </template>
    </dl>
  </div>
</template>

<style scoped>
.data-block {
  margin-bottom: var(--space-8);
}
.data-block:last-child {
  margin-bottom: 0;
}

/* Small-caps eyebrow label — demoted so it doesn't compete with the
 * main h2 alert title in the view header. Common admin-UI pattern
 * (Linear, Vercel, Stripe). */
.section-eyebrow {
  margin: 0 0 var(--space-3);
  padding: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

.data-grid {
  margin: 0;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.data-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
}
.data-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.data-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.data-value {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-base);
  line-height: 1.5;
  min-width: 0;
}
.data-value .dim {
  color: var(--color-text-dim);
  margin-left: var(--space-2);
}
</style>
