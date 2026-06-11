<script setup>
import { ref, onMounted } from 'vue'

const alerts = ref([])
const availableDiscussions = ref([])
const discussionsLoading = ref(true)

const selectedAlert = ref(null)
const mode = ref('none') // 'none' | 'new' | 'view'

const cargarAlertas = async () => {
  try {
    alerts.value = (await alertService.getAll()) || []
  } catch (error) {
    console.error('Error loading the alerts:', error)
  }
}

onMounted(() => {
  cargarAlertas()
  alertService.getDiscussionList()
    .then(d => { availableDiscussions.value = d })
    .catch(e => console.error('Failed to load discussions', e))
    .finally(() => { discussionsLoading.value = false })
})

const openNew = () => {
  selectedAlert.value = null
  mode.value = 'new'
}

const selectAlert = (alerta) => {
  selectedAlert.value = alerta
  mode.value = 'view'
}

const closeEditor = () => {
  selectedAlert.value = null
  mode.value = 'none'
}

// After a full save: close the editor immediately, then refresh the sidebar.
const onSaved = async () => {
  closeEditor()
  await cargarAlertas()
}

// After a lightweight update (e.g. status toggle): refresh the sidebar
// but keep the current alert open in view mode.
const onUpdated = async () => {
  await cargarAlertas()
  if (selectedAlert.value?.id) {
    selectedAlert.value = alerts.value.find(a => a.id === selectedAlert.value.id) || null
  }
}

const onDeleted = async () => {
  await cargarAlertas()
  closeEditor()
}
</script>

<template>
  <div class="layout-dark">

    <header class="top-nav">
      <div class="nav-content">
        <div class="brand">
          <span class="logo-text">
            <space></space>  
            <img src="./assets/olvid_name_logo.png" alt="logo" class="olvid-logo-img" />
            Alerting System
          </span>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="split">
        <!-- Left: alert list -->
        <div class="split-left">
          <AlertSidebar
            :alerts="alerts"
            :selected-id="selectedAlert?.id ?? null"
            @select="selectAlert"
            @new="openNew"
          />
        </div>

        <!-- Right: editor / detail -->
        <div class="split-right">
          <AlertEditor
            v-if="mode !== 'none'"
            :key="mode === 'new' ? 'new' : selectedAlert?.id"
            :alerta-inicial="selectedAlert"
            :available-discussions="availableDiscussions"
            :discussions-loading="discussionsLoading"
            @saved="onSaved"
            @updated="onUpdated"
            @deleted="onDeleted"
            @close="closeEditor"
          />

          <div v-else class="placeholder">
            <div class="placeholder-inner">
              <div class="ph-icon">🔔 </div>
              <p>Select an alert from the list, or create a new one.</p>
              <ButtonPrimary @click="openNew">
                <span class="plus-icon">+</span> New Alert
              </ButtonPrimary>
            </div>
          </div>
        </div>
      </div>
    </main>

  </div>
</template>

<style scoped>
:global(body) {
  background-color: #0f172a;
  color: #e2e8f0;
  margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.layout-dark { min-height: 100vh; display: flex; flex-direction: column; }

/* Top nav */
.top-nav {
  background-color: #0e1327;
  border-bottom: 1px solid #1b212b;
  padding: 15px 0;
  position: sticky; top: 0; z-index: 100;
}
.nav-content {
  max-width: 1400px; margin: 0 auto; padding: 0 24px;
  display: flex; justify-content: space-between; align-items: center;
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo-text {
  display: flex;
  align-items:end; 
  gap: 15px;
  font-size: 16px; 
  color: #94a3b8; 
  font-weight: 500;
}
.olvid-logo-img { 
  margin-left: 40px;
  width: 200px; 
  height:auto; 
  object-fit: contain; 
}

.plus-icon { font-size: 16px; line-height: 1; }

/* Main split */
.main-content {
  max-width: 1400px;
  width: 100%;
  margin: 24px auto;
  padding: 0 24px;
  flex-grow: 1;
  box-sizing: border-box;
}
.split {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  height: calc(100vh - 140px);
}
.split-left { min-height: 0; }
.split-right { min-height: 0; }

/* Placeholder */
.placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b1120;
  border: 1px dashed #1e293b;
  border-radius: 8px;
}
.placeholder-inner { text-align: center; color: #475569; }
.ph-icon { font-size: 40px; margin-bottom: 12px; }
.placeholder-inner p { margin: 0 0 18px; font-size: 14px; }
</style>
