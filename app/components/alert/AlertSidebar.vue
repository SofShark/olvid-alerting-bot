<script setup lang="ts">
import { AlertStatus, type AlertModel } from '#shared/constants'

const { t } = useI18n()

withDefaults(defineProps<{
  alerts?: AlertModel[]
  selectedId?: number | null
}>(), {
  alerts: () => [],
  selectedId: null
})

const emit = defineEmits(['select', 'new'])

const statusClass = (status: string) => ({
  'st-active': status === AlertStatus.Active,
  'st-inactive': status === AlertStatus.Inactive,
  'st-draft': status === AlertStatus.Draft,
})

const statusLabel = (status: string) => {
  if (status === AlertStatus.Active)   return t('sidebar.statusLabel.active')
  if (status === AlertStatus.Inactive) return t('sidebar.statusLabel.inactive')
  return t('sidebar.statusLabel.draft')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <span class="sidebar-title">{{$t('sidebar.title')}}</span>
      <!---- ><span class="sidebar-count">{{ alerts.length }}</span>-->
    </div>

    <div class="sidebar-body">
      <button
        v-for="a in alerts"
        :key="a.id ?? a.title"
        type="button"
        class="alert-row"
        :class="{ selected: a.id === selectedId }"
        @click="emit('select', a)"
      >
        <span class="status-dot" :class="statusClass(a.status)" :title="statusLabel(a.status)"></span>
        <span class="row-title">{{ a.title }}</span>
      </button>

      <div v-if="alerts.length === 0" class="sidebar-empty">
        {{ $t('sidebar.empty') }}
      </div>
    </div>

    <button type="button" class="btn-new-bottom" @click="emit('new')">
      <span class="plus">+</span> {{ $t('button.newAlert') }}
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

.sidebar-head {
  display: flex; 
  align-items: center;
  justify-content: center;
 
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}
.sidebar-title { 
  font-size: var(--text-base); 
  font-weight: 600; 
  color: var(--color-text-primary); 
}


.sidebar-count {
  margin-left: auto;
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 1px var(--space-3);
  border-radius: 10px;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.alert-row {
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-left: 1px solid transparent;
  color: var(--color-text-secondary);
  padding: 9px var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-base);
  transition: background-color .15s;
}
.alert-row:hover { background: var(--color-bg-card-soft); }
.alert-row.selected {
  background: var(--color-bg-card-soft);
  border-left-color: var(--color-accent);
  color: var(--color-text-primary);
}
.row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Status dots ─────────────────────────────────────────────────── */
.status-dot {
  width: 13px; height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.st-active   { background: var(--color-accent); border: 1px solid var(--color-accent); }
.st-inactive { background: transparent; border: 1px solid var(--color-text-dim); }
.st-draft    { background: transparent; border: 1px dashed var(--color-text-dim); }

.sidebar-empty {
  color: var(--color-text-faint);
  font-size: var(--text-md);
  text-align: center;
  padding: var(--space-8) var(--space-4);
  font-style: italic;
}

.btn-new-bottom {
  margin: var(--space-3);
  padding: 9px;
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  gap: var(--space-2);
  transition: background-color .15s, border-color .15s, color .15s;
}
.btn-new-bottom:hover {
  background: var(--color-border-default);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
.plus { font-size: var(--text-xl); line-height: 1; }
</style>
