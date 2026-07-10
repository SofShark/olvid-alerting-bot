<script setup lang="ts">
import { ref, computed } from "vue";
import type { MonitorParams } from "#shared/types/monitor";

/*
  Step 1 params editor for Monitoring alerts. Slimmer than
  TriggerParamsEditor (which handles Polling): only URL + Schedule, no
  format selector — Monitoring never parses a response body.

  The ScheduleEditor + ScheduleModeToggle are reused verbatim from
  input-source/; the cron infrastructure is shared with Polling.
*/

const props = defineProps<{
  modelValue: Partial<MonitorParams>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: Partial<MonitorParams>): void;
}>();

const p = computed(() => props.modelValue ?? {});

function set<K extends keyof MonitorParams>(key: K, value: MonitorParams[K]) {
  emit("update:modelValue", { ...p.value, [key]: value });
}

// Local UI state for the schedule mode pill. ScheduleEditor emits
// `update:mode` when the incoming cron doesn't fit basic mode.
const scheduleMode = ref<"basic" | "advanced">("basic");
</script>

<template>
  <div class="params-editor">
    <!-- URL -->
    <div class="field">
      <label class="field-label">
        {{ $t("monitorEditor.url.label") }}
        <span class="field-required">*</span>
      </label>
      <input
        type="url"
        :value="p.url ?? ''"
        :placeholder="$t('monitorEditor.url.placeholder')"
        class="field-input"
        @input="set('url', ($event.target as HTMLInputElement).value)"
      >
      <span class="field-hint">{{ $t("monitorEditor.url.hint") }}</span>
    </div>

    <!-- Schedule — same widget as polling; label + mode toggle on one row. -->
    <div class="field">
      <div class="field-head">
        <label class="field-label">
          {{ $t("monitorEditor.interval.label") }}
          <span class="field-required">*</span>
        </label>
        <ScheduleModeToggle v-model="scheduleMode" />
      </div>
      <ScheduleEditor
        :model-value="p.schedule ?? ''"
        :mode="scheduleMode"
        @update:model-value="set('schedule', $event)"
        @update:mode="scheduleMode = $event"
      />
    </div>
  </div>
</template>

<style scoped>
.params-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.field-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.field-head .field-label {
  margin: 0;
}
</style>
