import { onMounted, watch } from "vue";

// Single source of truth for the alert-sidebar's collapsed/expanded state.
// Shared across the layout (which adjusts its grid width) and AlertSidebar
// itself (which adjusts row content). Persisted to localStorage so the
// choice survives reload.
//
// Hydration: we MUST NOT read localStorage during setup, otherwise the
// server-rendered HTML (collapsed=false) doesn't match the initial client
// render (collapsed=true if the user previously chose that), producing a
// Vue hydration mismatch warning. The fix is to defer the read into
// onMounted — the class flip happens AFTER hydration, with a brief
// expanded-state flash if the user had collapsed. That trade-off is
// strictly better than a console warning + production class drift.

const STORAGE_KEY = "alerting:sidebar-collapsed";

export const useSidebar = () => {
  // useState gives SSR-safe shared state across the app. Default is
  // expanded. The server emits HTML with this default; the client
  // hydrates with the same default; THEN we read storage and update.
  const collapsed = useState<boolean>(
    "alerting-sidebar-collapsed",
    () => false,
  );

  onMounted(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) collapsed.value = saved === "1";
    } catch {
      /* storage blocked — keep default */
    }
  });

  // Persist on every change. The first client-side mutation post-hydration
  // is the read above; subsequent writes come from user toggles.
  watch(collapsed, (v) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* swallow — UX still works in-memory for the session */
    }
  });

  const toggle = () => {
    collapsed.value = !collapsed.value;
  };
  const expand = () => {
    collapsed.value = false;
  };

  return { collapsed, toggle, expand };
};
