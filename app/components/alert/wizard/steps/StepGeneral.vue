<script setup lang="ts">
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import type { PollingParams } from "#shared/types/polling";

/*
  Step 1: source picker + inline polling configuration (URL / format /
  timing) or webhook info card.

  Takes the wizard's `form` as a v-model so the source-binding setter
  (which seeds PollingParams on polling-pick, clears them on webhook)
  writes through to the parent without ceremony.
*/

const form = defineModel<AlertModel>({ required: true });

const selectedSource = useSourceBinding(form);
const isPolling = computed(() => form.value.input === Source.Polling);
const isWebhook = computed(() => form.value.input === Source.Webhook);
</script>

<template>
  <div>
    <div class="field">
      <label class="field-label">
        {{ $t("wizard.fieldLabels.inputSource") }}
        <span class="field-required">*</span>
      </label>
      <InputSourceSelector v-model="selectedSource" />
      <p v-if="form.input" class="field-hint">
        {{ $t("wizard.communicationHint") }}<strong>{{ form.input }}</strong
        >{{ $t("wizard.communicationHintSuffix") }}
      </p>
    </div>

    <!-- Polling sources expose URL / format / timing inline. -->
    <div v-if="isPolling" class="field">
      <label class="field-label">
        {{ $t("wizard.fieldLabels.pollingConfiguration") }}
        <span class="field-required">*</span>
      </label>
      <TriggerParamsEditor
        :trigger-type="form.input"
        :model-value="form.alertParams ?? {}"
        @update:model-value="form.alertParams = $event as PollingParams"
      />
    </div>

    <!-- Webhook source: info card inline here (no separate Trigger step). -->
    <template v-if="isWebhook">
      <div class="info-box">
        <span class="info-icon">ℹ</span>
        <div>
          <p class="info-title">{{ $t("wizard.webhookInfo.title") }}</p>
          <p class="info-text">
            <strong>{{ form.input }}</strong
            >{{ $t("wizard.webhookInfo.body") }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.field-hint strong {
  color: var(--color-accent-text);
  font-weight: 600;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
}
.info-icon {
  color: var(--color-accent-text);
  font-size: var(--text-xl);
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}
.info-title {
  margin: 0 0 var(--space-1);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  font-weight: 600;
}
.info-text {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-md);
  line-height: 1.4;
}
</style>
