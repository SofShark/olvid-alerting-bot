<script setup lang="ts">
import { Source, Trigger } from '#shared/constants'

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
const isRSS     = computed(() => props.source === Source.RSSFeed)

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
    // Switch to daily: store 86400 s and default time if none set.
    setMany({ intervalSeconds: 86400, dailyAt: p.value.dailyAt ?? '08:00' })
  } else {
    // Switch away from daily: keep current display value in new unit.
    const m = UNITS.find(u => u.label === unit)!.multiplier
    setMany({ intervalSeconds: intervalValue.value * m, dailyAt: undefined })
  }
}

const minValue = computed(() => UNITS.find(u => u.label === intervalUnit.value)!.min)
</script>

<template>
  <div v-if="isPolling" class="params-editor">

    <!-- URL -->
    <div class="param-field">
      <label class="param-label">URL <span class="req">*</span></label>
      <input
        type="url"
        :value="p.url ?? ''"
        :placeholder="isRSS ? 'https://example.com/feed.xml' : 'https://api.example.com/status'"
        class="param-input"
        @input="set('url', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="isRSS" class="param-hint">RSS or Atom feed URL</span>
      <span v-else class="param-hint">JSON endpoint — alert fires when the response changes</span>
    </div>

    <!-- Interval -->
    <div class="param-field">
      <label class="param-label">Poll interval <span class="req">*</span></label>
      <div class="interval-row">

        <!-- "every N" — hidden for daily -->
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

        <!-- "at HH:MM" — daily only -->
        <template v-else>
          <span class="interval-label">at</span>
          <input
            type="time"
            :value="p.dailyAt ?? '08:00'"
            class="param-input interval-time"
            @input="set('dailyAt', ($event.target as HTMLInputElement).value)"
          />
        </template>

        <!-- Unit selector — always visible -->
        <select
          :value="intervalUnit"
          class="param-input interval-unit"
          @change="onUnitChange(($event.target as HTMLSelectElement).value as UnitLabel)"
        >
          <option v-for="u in UNITS" :key="u.label" :value="u.label">{{ u.label }}</option>
        </select>

      </div>
    </div>

    <!-- Keyword filter — RSS only -->
    <div v-if="isRSS" class="param-field">
      <label class="param-label">Keyword filter <span class="param-optional">(optional)</span></label>
      <input
        type="text"
        :value="p.keyword ?? ''"
        placeholder="e.g. security, release, critical"
        class="param-input"
        @input="set('keyword', ($event.target as HTMLInputElement).value)"
      />
      <span class="param-hint">Only fire if the item title or description contains this word</span>
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
.param-optional { color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }

.param-input {
  padding: 8px 12px;
  background: #090d16; color: #f1f5f9;
  border: 1px solid #1e293b; border-radius: 5px;
  font-family: inherit; font-size: 13px;
  box-sizing: border-box; width: 100%;
}
.param-input:focus { outline: none; border-color: #3b82f6; }
.param-input::placeholder { color: #334155; }

/* Interval row */
.interval-row { display: flex; align-items: center; gap: 8px; }
.interval-label { font-size: 13px; color: #64748b; white-space: nowrap; flex-shrink: 0; }
.interval-number { width: 80px;  flex-shrink: 0; }
.interval-time   { width: 110px; flex-shrink: 0; color-scheme: dark; }
.interval-unit   { flex: 1; max-width: 130px; cursor: pointer; appearance: auto; }

.param-hint { font-size: 11px; color: #475569; }
</style>
