<script setup>
import { onMounted, computed, watch } from "vue";
const route = useRoute();
const { alerts, fetchAlerts, fetchDiscussions } = useAlerts();
const { collapsed: sidebarCollapsed } = useSidebar();

// `definePageMeta` is a compile-time helper that ONLY works inside a page —
// putting it here logs a "no effect" warning at runtime. Middleware for
// protected routes lives on each page's own <script setup> (see pages/index.vue).

const { user, clear: clearSession } = useUserSession();

async function logout() {
  await authService.logout();
  await clearSession();
  await navigateTo("/login");
}

async function goLogin() {
  await navigateTo("/login");
}

// Only fetch data when we actually have a session — otherwise every
// nav triggers a 401 that useAlerts silently swallows into empty
// arrays.
onMounted(() => {
  if (user.value) {
    fetchAlerts();
    fetchDiscussions();
  }
});
// After login the layout is already mounted, so onMounted won't refire.
// Watching `user` covers that: sign in → lists populate, sign out → they clear.
watch(user, (u) => {
  if (u) {
    fetchAlerts();
    fetchDiscussions();
  } else {
    alerts.value = [];
  }
});

const selectedId = computed(() => {
  const id = route.params.id;
  return id ? Number(id) : null;
});
</script>

<template>
  <div class="layout">
    <header class="top-nav">
      <div class="nav-content">
        <div class="brand">
          <span class="logo-text">
            <img
              src="../assets/olvid_name_logo.png"
              alt="Olvid"
              class="olvid-logo-img"
            />
            {{ $t("topNav.title") }}
          </span>
        </div>

        <div class="nav-actions">
          <LanguageToggle />
          <button
            v-if="user && user.role === 'admin'"
            class="nav-toggle"
            @click="navigateTo(`/users`)"
          >
            <LucideUserCog :stroke-width="2" />
            Users
          </button>

          <!-- Signed in → account dropdown with session info + logout.
               Signed out → plain login shortcut. -->
          <AccountMenu v-if="user" @logout="logout" />
          <button v-else class="nav-toggle" @click="goLogin">
            <LucideUser :stroke-width="2" /> Login
          </button>
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
            :disabled="!user"
            @select="(a) => navigateTo('/alerts/' + a.id)"
            @new="navigateTo('/alerts/new')"
          />
        </div>

        <div class="split-right">
          <slot :key="route.path" />
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
.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-nav {
  background-color: var(--color-bg-nav);
  border-bottom: 1px solid var(--color-border-subltle);
  flex-shrink: 0;
  z-index: 100;
}
.nav-content {
  width: 100%;
  padding: 10px 24px 10px 10px;
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
/* Logo is a fixed-colour PNG — under the mildly-lit dark navbar it
 * blends in. Pin it against a small dark surface so it reads with
 * proper contrast. In light mode the nav is already dark enough
 * against the logo, so we clear the surface. */
.olvid-logo-img {
  width: 120px;
  height: auto;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.2);
  padding: 0;
  border-radius: var(--radius-sm);
  /* Soft dark halo — spreads the tint past the image rectangle so
   * the edge feathers into the nav instead of showing a hard border. */
  box-shadow: 0 0 10px 6px rgba(0, 0, 0, 0.2);
}

:root[data-theme="light"] .olvid-logo-img {
  background: transparent;
  padding: 0;
  box-shadow: none;
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
.split-left {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

/* Right column is a flex container: the routed component (panel or
 * wizard) flexes to fill it exactly. NO scroll here — each routed
 * component owns its own internal scroll (AlertLogs, wizard-content). */
.split-right {
  padding: 10px;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.split-right > * {
  flex: 1;
  min-height: 0;
}
</style>
