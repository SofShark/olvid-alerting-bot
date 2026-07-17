<script setup>
import { onMounted, computed } from "vue";
const route = useRoute();
const { alerts, fetchAlerts, fetchDiscussions } = useAlerts();
const { collapsed: sidebarCollapsed } = useSidebar();

// Language switching now lives inside <LanguageToggle/> — same chrome as
// ThemeToggle, dropdown of available locales. Layout no longer needs to
// know about i18n internals.

onMounted(() => {
  fetchAlerts();
  fetchDiscussions();
});

// Highlight the sidebar row that matches the current route.
const selectedId = computed(() => {
  const id = route.params.id;
  return id ? Number(id) : null;
});
</script>

<template>
  <div class="layout-dark">
    <header class="top-nav">
      <div class="nav-content">
        <div class="brand">
          <span class="logo-text">
            <img
              src="../assets/olvid_name_logo.png"
              alt="Olvid"
              class="olvid-logo-img"
            >
            {{ $t("topNav.title") }}
          </span>
        </div>

        <div class="nav-actions">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="split" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <div class="split-left">
          <AlertSidebar
            :alerts="alerts"
            :selected-id="selectedId"
            @select="(a) => navigateTo('/alerts/' + a.id)"
            @new="navigateTo('/alerts/new')"
          />
        </div>

        <div class="split-right">
          <slot :key="route.path" />
          <!-- :key="route.path"-->
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Lock the page to the viewport so nothing scrolls behind the nav. The
 * nav sizes to its own content; the main area takes whatever's left.
 * Internal scrolling happens INSIDE .split-left and .split-right, never
 * at the document level — this is what was causing the "+ New" button
 * to disappear off the bottom of the screen. */
.layout-dark {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-nav {
  background-color: var(--color-bg-nav);
  border-bottom: 1px solid var(--color-border-default);
  padding: 14px 0;
  flex-shrink: 0;
  z-index: 100;
}
.nav-content {
  width: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo-text {
  display: flex;
  align-items: flex-end;
  gap: 15px;
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: 500;
}
.olvid-logo-img {
  margin-left: 15px;
  width: 150px;
  height: auto;
  object-fit: contain;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Main content absorbs the remaining viewport height; min-height: 0 is
 * critical for flex children that themselves need to scroll internally. */
.main-content {
  width: 100%;
  padding: 0;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}
/* Grid columns driven by --sidebar-w so toggling animates smoothly.
 * height: 100% (not 100vh) so the parent flex layout governs the height. */
.split {
  display: grid;
  grid-template-columns: var(--sidebar-w, 200px) 1fr;
  gap: 0;
  height: 100%;
  --sidebar-w: 200px;
  transition: grid-template-columns 0.18s ease;
}

.split.sidebar-collapsed {
  --sidebar-w: 64px;
}
.split-left,
.split-right {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

/* Sidebar recedes to the app background so it doesn't collide with the
 * top nav's `bg-nav` (which is pure white in light mode). The sidebar
 * reads as chrome extending the page, not a floating card next to the
 * nav. Right border divides rail from content; the nav's bottom border
 * already caps the top. */
.split-left :deep(.sidebar) {
  background: var(--color-bg-app);
  border: none;
  border-right: 1px solid var(--color-border-subtle);
  border-radius: 0;
}

/* Main content area gets breathing room; internal scroll lives in the
 * routed component (AlertEditor / AlertWizard), not on this container. */
.split-right {
  padding: 0;
}
</style>
