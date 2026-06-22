<script setup>
import { onMounted, computed } from 'vue'
const route = useRoute()
const { alerts, fetchAlerts, fetchDiscussions } = useAlerts()

// Language switching now lives inside <LanguageToggle/> — same chrome as
// ThemeToggle, dropdown of available locales. Layout no longer needs to
// know about i18n internals.

onMounted(() => {
  fetchAlerts()
  fetchDiscussions()
})

// Highlight the sidebar row that matches the current route.
const selectedId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
</script>

<template>
  <div class="layout-dark">

    <header class="top-nav">
      <div class="nav-content">
        <div class="brand">
          <span class="logo-text">
            <img src="../assets/olvid_name_logo.png" alt="Olvid" class="olvid-logo-img" />
            {{$t('topNav.title')}}
          </span>
        </div>

        <div class="nav-actions">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="split">

        <div class="split-left">
          <AlertSidebar
            :alerts="alerts"
            :selected-id="selectedId"
            @select="a => navigateTo('/alerts/' + a.id)"
            @new="navigateTo('/alerts/new')"
          />
        </div>

        <div class="split-right">
          <slot 
          :key="route.path"/>
          <!-- :key="route.path"-->
        </div>

      </div>
    </main>

  </div>
</template>

<style scoped>
.layout-dark { min-height: 100vh; display: flex; flex-direction: column; }

.top-nav {
  background-color: var(--color-bg-nav);
  border-bottom: 1px solid var(--color-border-subtle);
  padding: 14px 0;
  position: sticky; top: 0; z-index: 100;
}
.nav-content {
  width: 100%; margin: 0 auto; padding: 0 24px;
  display: flex; justify-content: space-between; align-items: center;
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo-text {
  display: flex; align-items: flex-end; gap: 15px;
  font-size: 16px; color: var(--color-text-muted); font-weight: 500;
}
.olvid-logo-img { margin-left: 40px; width: 200px; height: auto; object-fit: contain; }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-content {
  width: 100%;
  margin: 18px auto; padding: 0 18px;
  flex-grow: 1; box-sizing: border-box;
}
.split {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 18px;
  height: calc(100vh - 120px);
}
.split-left  { 
  min-height: 0;
  overflow-y: auto;
}
.split-right { 
  min-height: 0;
  overflow-y: auto;
}



</style>
