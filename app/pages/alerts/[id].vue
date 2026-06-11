<script setup lang="ts">
const route  = useRoute()
const { alerts, alertsLoading, fetchAlerts } = useAlerts()

// Fetch on hard-refresh if the layout hasn't populated the list yet.
onMounted(() => {
  if (alerts.value.length === 0 && !alertsLoading.value) fetchAlerts()
})

const alert = computed(() =>
  alerts.value.find(a => a.id === Number(route.params.id)) ?? null
)
</script>

<template>
  <div v-if="alertsLoading || !alert" class="loading-panel">
    <span v-if="alertsLoading">Loading…</span>
    <span v-else>Alert not found.</span>
  </div>
  <AlertEditor v-else :key="alert.id?.toString()" :alerta-inicial="alert" />
</template>

<style scoped>
.loading-panel {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: #0b1120;
  border: 1px dashed #1e293b;
  border-radius: 8px;
  color: #475569;
  font-size: 14px;
}
</style>
