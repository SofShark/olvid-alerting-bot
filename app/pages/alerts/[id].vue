<script setup lang="ts">
definePageMeta({
    middleware: ["auth"],
  });

const route = ref(useRoute());
const { alerts, alertsLoading, fetchAlerts } = useAlerts();

// Fetch on hard-refresh if the layout hasn't populated the list yet.
onMounted(() => {
  if (alerts.value.length === 0 && !alertsLoading.value) fetchAlerts();
});

const alert = computed(
  () =>
    alerts.value.find((a) => a.id === Number(route.value.params.id)) ?? null,
);

// Explicit edit request via query (?edit=1) puts a non-draft alert into the
// wizard for full reconfiguration. Drafts always open in the wizard.
const isEditing = computed(() => route.value.query.edit === "1");

  
</script>
<template>
  <div v-if="alertsLoading || !alert" class="loading-panel">
    <span v-if="alertsLoading">{{ $t("alertPage.loading") }}</span>
    <span v-else>{{ $t("alertPage.notFound") }}</span>
  </div>
  <AlertWizard
    v-else-if="isEditing"
    :key="`wizard-${alert.id?.toString()}`"
    :initial-alert="alert"
  />
  <AlertView
    v-else
    :key="`view-${alert.id?.toString()}`"
    :initial-alert="alert"
  />
</template>

<style scoped>
.loading-panel {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-xl);
  color: var(--color-text-faint);
  font-size: 14px;
}
</style>
