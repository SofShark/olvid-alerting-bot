<script setup lang="ts">
import { computed } from 'vue'
import { Source }              from '#shared/types/source'
import type { PollingParams }  from '#shared/types/polling'

/*
  INPUT block in view mode. Renders the alert's source-side configuration:
    - Webhook → just the endpoint URL.
    - Polling → URL, format · interval, condition summary.

  Layout-only — delegates the condition row to AlertConditionSummary.
  Interval label comes from useIntervalLabel so the wording matches the
  wizard's UI.
*/

const props = defineProps<{
  inputTitle:    string //TODO deprecated
  source:        string
  alertParams?:  PollingParams
  webhookUrl?:   string
}>()

const { intervalLabel } = useIntervalLabel()

const isPolling = computed(() => props.source === Source.Polling)
const isWebhook = computed(() => props.source === Source.Webhook)

const pollingInterval = computed(() => intervalLabel(props.alertParams?.intervalSeconds))
</script>

<template>
  <div class="data-block">
    <h3 class="data-title">Configuration</h3>
    
    <dl class="data-grid">

      <template v-if="isWebhook">
        <div v-if="webhookUrl" class="data-row">
          <dt class="data-label">{{ $t('editor.view.fields.endpoint') }}</dt>
          <dd class="data-value">
            <URLCopyBox :url="webhookUrl" />
          </dd>
        </div>
      </template>

      <template v-else-if="isPolling">
        <div class="data-row">
          <dt class="data-label">{{ $t('editor.view.fields.url') }}</dt>
          <dd class="data-value">
            <URLCopyBox :url="alertParams?.url || '——'" />
          </dd>
        </div>
        <div class="data-row">
          <dt class="data-label">{{ $t('editor.view.fields.polling') }}</dt>
          <dd class="data-value">
            {{ alertParams?.format || $t('editor.interval.empty') }}
            <span class="dim">· {{ pollingInterval }}</span>
          </dd>
        </div>
        <div class="data-row">
          <dt class="data-label">{{ $t('editor.view.fields.condition') }}</dt>
          <dd class="data-value">
            <AlertConditionSummary :condition="alertParams?.condition" />
          </dd>
        </div>
      </template>

    </dl>
  </div>
</template>

<style scoped>
.data-block { margin-bottom: var(--space-8); }
.data-block:last-child { margin-bottom: 0; }

.data-title {
  margin: 0;
  padding: 0 0 var(--space-3);
  font-weight: 700;
  color: var(--color-text-primary);
}

.data-grid {
  margin: 0; padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.data-row {
  display: flex; flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
}
.data-row:last-child { border-bottom: none; padding-bottom: 0; }
.data-label {
  margin: 0; font-size: 11px; font-weight: 700;
  letter-spacing: 0.5px; text-transform: uppercase;
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
