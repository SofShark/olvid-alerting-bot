<script setup lang="ts">
import { AlertStatus, type AlertModel } from '#shared/constants'

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
  if (status === AlertStatus.Active) return 'Active'
  if (status === AlertStatus.Inactive) return 'Inactive'
  return 'Draft'
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <span class="sidebar-title">Alert List</span>
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
        <span class="row-title">{{ a.title || 'Untitled' }}</span>
      </button>

      <div v-if="alerts.length === 0" class="sidebar-empty">
        No alerts yet.
      </div>
    </div>

    <button type="button" class="btn-new-bottom" @click="emit('new')">
      <span class="plus">+</span> New Alert
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: #0b1120;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

.sidebar-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}
.sidebar-title { font-size: 13px; font-weight: 600; color: #f1f5f9; }
.sidebar-count {
  margin-left: auto;
  background: #1e293b;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  
  border-left: 1px solid transparent;
  color: #cbd5e1;
  padding: 9px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.15s;
}
.alert-row:hover { background: #151f32; }
.alert-row.selected {
  background: #151f32;
  border-left-color: #3b82f6;
  color: #f1f5f9;
}

.row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Status circles */
.status-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.st-active { background: #3b82f6; border: 1px solid #3b82f6; }
.st-inactive { background: transparent; border: 1px solid #64748b; }
.st-draft { background: transparent; border: 1px dashed #64748b; }

.sidebar-empty {
  color: #475569;
  font-size: 12px;
  text-align: center;
  padding: 24px 12px;
  font-style: italic;
}

.btn-new-bottom {
  margin: 8px;
  padding: 9px;
  background: #1e293b;
  color: #cbd5e1;
  border: 1px dashed #334155;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
}
.btn-new-bottom:hover { background: #334155; color: #f1f5f9; border-color: #475569; }
.plus { font-size: 16px; line-height: 1; }
</style>
