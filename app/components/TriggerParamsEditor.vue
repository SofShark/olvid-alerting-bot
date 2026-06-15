<script setup lang="ts">
import { PollingFormat, Trigger } from '#shared/constants'

const props = defineProps<{
  source:      string
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

const isPolling = computed(() => props.triggerType === Trigger.Polling)

// ── Poll interval ───────────────────────────────────────────────────────────

const UNITS = [
  { label: 'seconds', multiplier: 1,     min: 10  },
  { label: 'minutes', multiplier: 60,    min: 1   },
  { label: 'hours',   multiplier: 3600,  min: 1   },
  { label: 'daily',   multiplier: 86400, min: 1   },
] as const

type UnitLabel = typeof UNITS[number]['label']

function detectUnit(seconds: number): UnitLabel {
  if (seconds % 86400 === 0) return 'daily'
  if (seconds % 3600  === 0) return 'hours'
  if (seconds % 60    === 0) return 'minutes'
  return 'seconds'
}

const storedSeconds = computed(() => Number(p.value.intervalSeconds) || 300)
const intervalUnit  = ref<UnitLabel>(detectUnit(storedSeconds.value))
const isDaily       = computed(() => intervalUnit.value === 'daily')

const intervalValue = computed(() => {
  const m = UNITS.find(u => u.label === intervalUnit.value)!.multiplier
  return storedSeconds.value / m
})

watch(storedSeconds, (s) => { intervalUnit.value = detectUnit(s) })

function onValueInput(raw: string) {
  const num = Math.max(1, Number(raw) || 1)
  const m   = UNITS.find(u => u.label === intervalUnit.value)!.multiplier
  set('intervalSeconds', num * m)
}

function onUnitChange(unit: UnitLabel) {
  intervalUnit.value = unit
  if (unit === 'daily') {
    setMany({ intervalSeconds: 86400, dailyAt: p.value.dailyAt ?? '08:00' })
  } else {
    const m = UNITS.find(u => u.label === unit)!.multiplier
    setMany({ intervalSeconds: intervalValue.value * m, dailyAt: undefined })
  }
}

const minValue = computed(() => UNITS.find(u => u.label === intervalUnit.value)!.min)

const FORMATS = Object.values(PollingFormat)
const selectedFormat = computed(() => (p.value.format as PollingFormat) ?? PollingFormat.XML)
</script>

<template>
  <div v-if="isPolling" class="params-editor">

    <!-- URL -->
    <div class="param-field">
      <label class="param-label">URL <span class="req">*</span></label>
      <input
        type="url"
        :value="p.url ?? ''"
        placeholder="https://example.com/feed.xml"
        class="param-input"
        @input="set('url', ($event.target as HTMLInputElement).value)"
      />
      <span class="param-hint">Endpoint the alert system will poll.</span>
    </div>

    <!-- Format -->
    <div class="param-field">
      <label class="param-label">Format <span class="req">*</span></label>
      <select
        :value="selectedFormat"
        class="param-input"
        @change="set('format', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <span class="param-hint">Content type returned by the URL.</span>
    </div>

    <!-- Interval -->
    <div class="param-field">
      <label class="param-label">Poll interval <span class="req">*</span></label>
      <div class="interval-row">

        <template v-if="!isDaily">
          <span class="interval-label">every</span>
          <input
            type="number"
            :value="intervalValue"
            :min="minValue"
            class="param-input interval-number"
            @input="onValueInput(($event.target as HTMLInputElement).value)"
          />
        </template>

        <template v-else>
          <span class="interval-label">at</span>
          <input
            type="time"
            :value="p.dailyAt ?? '08:00'"
            class="param-input interval-time"
            @input="set('dailyAt', ($event.target as HTMLInputElement).value)"
          />
        </template>

        <select
          :value="intervalUnit"
          class="param-input interval-unit"
          @change="onUnitChange(($event.target as HTMLSelectElement).value as UnitLabel)"
        >
          <option v-for="u in UNITS" :key="u.label" :value="u.label">{{ u.label }}</option>
        </select>

      </div>
    </div>

  </div>
</template>

<style scoped>
.params-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
}
.param-field { display: flex; flex-direction: column; gap: 5px; }
.param-label {
  font-size: 12px; font-weight: 600; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.req { color: #ef4444; }

.param-input {
  padding: 8px 12px;
  background: #090d16; color: #f1f5f9;
  border: 1px solid #1e293b; border-radius: 5px;
  font-family: inherit; font-size: 13px;
  box-sizing: border-box; width: 100%;
}
.param-input:focus { outline: none; border-color: #3b82f6; }
.param-input::placeholder { color: #334155; }

.interval-row { display: flex; align-items: center; gap: 8px; }
.interval-label { font-size: 13px; color: #64748b; white-space: nowrap; flex-shrink: 0; }
.interval-number { width: 80px;  flex-shrink: 0; }
.interval-time   { width: 110px; flex-shrink: 0; color-scheme: dark; }
.interval-unit   { flex: 1; max-width: 130px; cursor: pointer; appearance: auto; }

.param-hint { font-size: 11px; color: #475569; }
</style>
