<script setup lang="ts">
import { Source }        from '#shared/types/source'
import { PollingFormat } from '#shared/types/polling'

// The alert's source IS the only type discriminator — `triggerType` here
// receives `form.input` (a Source value) from the wizard. No separate
// `source` prop: it would be the same string.
const props = defineProps<{
  triggerType: string
  modelValue:  Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, any>): void
}>()

const p = computed(() => props.modelValue ?? {})

function set(key: string, value: any) {
  emit('update:modelValue', { ...p.value, [key]: value })
}

function setMany(patch: Record<string, any>) {
  emit('update:modelValue', { ...p.value, ...patch })
}

const isPolling = computed(() => props.triggerType === Source.Polling)

// ── Poll interval ───────────────────────────────────────────────────────────

const { t } = useI18n()

// Unit labels here are i18n KEYS (used both as the select option value and as
// the `label` field for translation lookup). The form's unit storage uses
// these keys, not the localized strings — `detectUnit` etc. keep working.
const UNITS = [
  { label: 'minutes', multiplier: 60,    min: 1   },
  { label: 'hours',   multiplier: 3600,  min: 1   },
  { label: 'daily',   multiplier: 86400, min: 1   },
] as const

type UnitLabel = typeof UNITS[number]['label']

// Minimum polling interval is 1 minute — sub-minute polling is excluded.
const MIN_INTERVAL_SECONDS = 60

function detectUnit(seconds: number): UnitLabel {
  if (seconds % 86400 === 0) return 'daily'
  if (seconds % 3600  === 0) return 'hours'
  return 'minutes'
}

const storedSeconds = computed(() =>
  Math.max(MIN_INTERVAL_SECONDS, Number(p.value.intervalSeconds) || 300),
)
const intervalUnit  = ref<UnitLabel>(detectUnit(storedSeconds.value))
const isDaily       = computed(() => intervalUnit.value === 'daily')

const intervalValue = computed(() => {
  const m = UNITS.find(u => u.label === intervalUnit.value)!.multiplier
  return storedSeconds.value / m
})

watch(storedSeconds, (s) => { intervalUnit.value = detectUnit(s) })

function onValueInput(raw: string) {
  const unit    = UNITS.find(u => u.label === intervalUnit.value)!
  const num     = Math.max(unit.min, Number(raw) || unit.min)
  const seconds = Math.max(MIN_INTERVAL_SECONDS, num * unit.multiplier)
  set('intervalSeconds', seconds)
}

function onUnitChange(unit: UnitLabel) {
  if (unit === 'daily') {
    intervalUnit.value = unit
    setMany({ intervalSeconds: 86400, dailyAt: p.value.dailyAt ?? '08:00' })
    return
  }
  // Number-input and unit-select are independent: switching the unit keeps
  // the displayed number unchanged. "10 minutes" → "10 hours", not 0.166 h.
  // We capture the currently-displayed value BEFORE flipping intervalUnit
  // since intervalValue is derived from (storedSeconds / current multiplier).
  const displayed = isDaily.value ? UNITS.find(u => u.label === unit)!.min : intervalValue.value
  const multiplier = UNITS.find(u => u.label === unit)!.multiplier
  intervalUnit.value = unit
  const seconds = Math.max(MIN_INTERVAL_SECONDS, displayed * multiplier)
  setMany({ intervalSeconds: seconds, dailyAt: undefined })
}

const minValue = computed(() => UNITS.find(u => u.label === intervalUnit.value)!.min)

const FORMATS = Object.values(PollingFormat)
const selectedFormat = computed(() => (p.value.format as PollingFormat) ?? PollingFormat.XML)
</script>

<template>
  <div v-if="isPolling" class="params-editor">

    <!-- URL -->
    <div class="field">
      <label class="field-label">{{ $t('alertParamsEditor.url.label') }} <span class="field-required">*</span></label>
      <input
        type="url"
        :value="p.url ?? ''"
        :placeholder="$t('alertParamsEditor.url.placeholder')"
        class="field-input"
        @input="set('url', ($event.target as HTMLInputElement).value)"
      />
      <span class="field-hint">{{ $t('alertParamsEditor.url.hint') }}</span>
    </div>

    <!-- Format -->
    <div class="field">
      <label class="field-label">{{ $t('alertParamsEditor.format.label') }} <span class="field-required">*</span></label>
      <select
        :value="selectedFormat"
        class="field-input"
        @change="set('format', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <span class="field-hint">{{ $t('alertParamsEditor.format.hint') }}</span>
    </div>

    <!-- Interval -->
    <div class="field">
      <label class="field-label">{{ $t('alertParamsEditor.interval.label') }} <span class="field-required">*</span></label>
      <div class="interval-row">

        <template v-if="!isDaily">
          <span class="interval-label">{{ $t('alertParamsEditor.interval.every') }}</span>
          <input
            type="number"
            :value="intervalValue"
            :min="minValue"
            class="field-input interval-number"
            @input="onValueInput(($event.target as HTMLInputElement).value)"
          />
        </template>

        <template v-else>
          <span class="interval-label">{{ $t('alertParamsEditor.interval.at') }}</span>
          <input
            type="time"
            :value="p.dailyAt ?? '08:00'"
            class="field-input interval-time"
            @input="set('dailyAt', ($event.target as HTMLInputElement).value)"
          />
        </template>

        <select
          :value="intervalUnit"
          class="field-input interval-unit"
          @change="onUnitChange(($event.target as HTMLSelectElement).value as UnitLabel)"
        >
          <option v-for="u in UNITS" :key="u.label" :value="u.label">{{ $t(`alertParamsEditor.units.${u.label}`) }}</option>
        </select>

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
.interval-row { display: flex; align-items: center; gap: var(--space-3); }
.interval-label { font-size: var(--text-base); color: var(--color-text-dim); white-space: nowrap; flex-shrink: 0; }
.interval-number { width: 80px;  flex-shrink: 0; }
.interval-time   { width: 110px; flex-shrink: 0; color-scheme: dark; }
.interval-unit   { flex: 1; max-width: 130px; cursor: pointer; appearance: auto; }
</style>
