<script setup lang="ts">
import { Source } from "#shared/types/source";
import { PollingFormat } from "#shared/types/polling";
import {
  scheduler,
  DEFAULT_SCHEDULE,
  type ScheduleMode,
} from "#shared/polling/scheduler";

// The alert's source IS the only type discriminator — `triggerType` here
// receives `form.input` (a Source value) from the wizard. No separate
// `source` prop: it would be the same string.
const props = defineProps<{
  triggerType: string;
  modelValue: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: Record<string, any>): void;
}>();

const p = computed(() => props.modelValue ?? {});

function set(key: string, value: any) {
  emit("update:modelValue", { ...p.value, [key]: value });
}

const isPolling = computed(() => props.triggerType === Source.Polling);

// ── Schedule (cron-backed) ─────────────────────────────────────────────────
//
// The wizard exposes three friendly modes (every N minutes / every N hours /
// daily at HH:MM). Internally each combination is serialised into a cron
// expression stored on `params.schedule`. `cronToMode` reverses the
// classification when the wizard re-opens an existing alert.
//
// Anything that doesn't match those three patterns (advanced user-written
// cron) reads back as `unit: 'custom'` and the editor falls back to a
// read-only display — we don't ship a raw-cron input yet.

type FriendlyUnit = "minutes" | "hours" | "daily";

const UNITS: ReadonlyArray<{ label: FriendlyUnit; min: number }> = [
  { label: "minutes", min: 1 },
  { label: "hours", min: 1 },
  { label: "daily", min: 1 },
];

const currentMode = computed<ScheduleMode>(() =>
  scheduler.cronToMode(p.value.schedule ?? DEFAULT_SCHEDULE),
);

const intervalUnit = computed<FriendlyUnit | "custom">(
  () => currentMode.value.unit,
);

const isDaily = computed(() => intervalUnit.value === "daily");
const isCustom = computed(() => intervalUnit.value === "custom");

// Number shown in the minute / hour input. 1 is a safe fallback for the
// brief moments the mode flips from daily/custom to a numeric unit before
// the next emit lands.
const intervalValue = computed(() => {
  const m = currentMode.value;
  if (m.unit === "minutes" || m.unit === "hours") return m.value;
  return 1;
});

const dailyAtValue = computed(() => {
  const m = currentMode.value;
  return m.unit === "daily" ? m.dailyAt : "08:00";
});

const minValue = computed(() => 1);

// Write a fresh cron whenever the user touches any of the three controls.
// All branches go through `modeToCron` so the serialisation rule lives in
// one place (shared/polling/schedule.ts).
function emitScheduleFromMode(mode: ScheduleMode) {
  set("schedule", scheduler.modeToCron(mode));
}

function onValueInput(raw: string) {
  const unit = intervalUnit.value;
  if (unit !== "minutes" && unit !== "hours") return;
  const n = Math.max(1, Number(raw) || 1);
  emitScheduleFromMode({ unit, value: n });
}

function onDailyAtInput(raw: string) {
  emitScheduleFromMode({ unit: "daily", dailyAt: raw || "08:00" });
}

function onUnitChange(unit: FriendlyUnit) {
  if (unit === "daily") {
    emitScheduleFromMode({ unit: "daily", dailyAt: dailyAtValue.value });
    return;
  }
  // Switching minutes ↔ hours preserves the displayed number ("5 minutes"
  // → "5 hours", not 0.08 h). When coming from daily / custom we start at 1
  // so the user lands on a sensible value.
  const carry =
    intervalUnit.value === "minutes" || intervalUnit.value === "hours"
      ? intervalValue.value
      : 1;
  emitScheduleFromMode({ unit, value: Math.max(1, carry) });
}

const FORMATS = Object.values(PollingFormat);
const selectedFormat = computed(
  () => (p.value.format as PollingFormat) ?? PollingFormat.XML,
);

// Trigger-mode picker now lives in StepTrigger, next to the ConditionEditor —
// the gate ("only meaningful when condition.kind=Rule and operator!=Changed")
// makes far more sense in the step where the user is actively shaping the
// condition. Keeping it here would mean the field stays hidden in Step 1
// (condition is still blank) and only surfaces in Step 1 when you go back
// after configuring the condition in Step 2 — backwards.
</script>

<template>
  <div v-if="isPolling" class="params-editor">
    <!-- URL -->
    <div class="field">
      <label class="field-label"
        >{{ $t("alertParamsEditor.url.label") }}
        <span class="field-required">*</span></label
      >
      <input
        type="url"
        :value="p.url ?? ''"
        :placeholder="$t('alertParamsEditor.url.placeholder')"
        class="field-input"
        @input="set('url', ($event.target as HTMLInputElement).value)"
      >
      <span class="field-hint">{{ $t("alertParamsEditor.url.hint") }}</span>
    </div>

    <!-- Format -->
    <div class="field">
      <label class="field-label"
        >{{ $t("alertParamsEditor.format.label") }}
        <span class="field-required">*</span></label
      >
      <select
        :value="selectedFormat"
        class="field-input"
        @change="set('format', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <span class="field-hint">{{ $t("alertParamsEditor.format.hint") }}</span>
    </div>

    <!-- Interval -->
    <div class="field">
      <label class="field-label"
        >{{ $t("alertParamsEditor.interval.label") }}
        <span class="field-required">*</span></label
      >

      <!-- Friendly-mode controls. A custom cron (advanced user) shows
           read-only here; future: an "Advanced" toggle to edit the raw expr. -->
      <div v-if="!isCustom" class="interval-row">
        <template v-if="!isDaily">
          <span class="interval-label">{{
            $t("alertParamsEditor.interval.every")
          }}</span>
          <input
            type="number"
            :value="intervalValue"
            :min="minValue"
            class="field-input interval-number"
            @input="onValueInput(($event.target as HTMLInputElement).value)"
          >
        </template>

        <template v-else>
          <span class="interval-label">{{
            $t("alertParamsEditor.interval.at")
          }}</span>
          <input
            type="time"
            :value="dailyAtValue"
            class="field-input interval-time"
            @input="onDailyAtInput(($event.target as HTMLInputElement).value)"
          >
        </template>

        <select
          :value="intervalUnit"
          class="field-input interval-unit"
          @change="
            onUnitChange(
              ($event.target as HTMLSelectElement).value as FriendlyUnit,
            )
          "
        >
          <option v-for="u in UNITS" :key="u.label" :value="u.label">
            {{ $t(`alertParamsEditor.units.${u.label}`) }}
          </option>
        </select>
      </div>

      <!-- Advanced cron, read-only fallback. -->
      <div v-else class="custom-row">
        <code class="custom-cron">{{ p.schedule }}</code>
        <span class="field-hint">Advanced cron — edit in raw mode (coming soon)</span>
      </div>
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

/* Interval row composition is unique to this editor — number + unit on one
 * line, swapping to a time picker in 'daily' mode. */
.interval-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.interval-label {
  font-size: var(--text-base);
  color: var(--color-text-dim);
  white-space: nowrap;
  flex-shrink: 0;
}
.interval-number {
  width: 80px;
  flex-shrink: 0;
}
.interval-time {
  width: 110px;
  flex-shrink: 0;
  color-scheme: dark;
}
.interval-unit {
  flex: 1;
  max-width: 130px;
  cursor: pointer;
  appearance: auto;
}

.custom-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.custom-cron {
  display: inline-block;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
