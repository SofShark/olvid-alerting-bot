<script setup lang="ts">
import { AlertStatus } from '#shared/constants'

const route  = useRoute()
const { alerts, alertsLoading, fetchAlerts } = useAlerts()

// Fetch on hard-refresh if the layout hasn't populated the list yet.
onMounted(() => {
  if (alerts.value.length === 0 && !alertsLoading.value) fetchAlerts()
})

const alert = computed(() =>
  alerts.value.find(a => a.id === Number(route.params.id)) ?? null
)

const isDraft = computed(() => alert.value?.status === AlertStatus.Draft)
</script>

<template>
  <div v-if="alertsLoading || !alert" class="loading-panel">
    <span v-if="alertsLoading">Loading…</span>
    <span v-else>Alert not found.</span>
  </div>
  <AlertWizard
    v-else-if="isDraft"
    :key="`wizard-${alert.id?.toString()}`"
    :alerta-inicial="alert"
  />
  <AlertEditor
    v-else
    :key="`editor-${alert.id?.toString()}`"
    :alerta-inicial="alert"
  />
</template>

<style scoped>
.loading-panel {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-xl);
  color: var(--color-text-faint);
  font-size: 14px;
}
</style>
