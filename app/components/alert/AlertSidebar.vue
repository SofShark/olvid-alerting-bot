<script setup lang="ts">
import { AlertStatus, type AlertModel } from "#shared/types/alert";

const { t } = useI18n();
const { collapsed, toggle } = useSidebar();

const props = withDefaults(
  defineProps<{
    alerts?: AlertModel[];
    selectedId?: number | null;
    // When true (no session), the row list and "+ New Alert" button
    // become read-only affordances; no fetches, no navigation.
    disabled?: boolean;
  }>(),
  {
    alerts: () => [],
    selectedId: null,
    disabled: false,
  },
);

const emit = defineEmits(["select", "new"]);

function onSelect(a: AlertModel) {
  if (props.disabled) return;
  emit("select", a);
}
function onNew() {
  if (props.disabled) return;
  emit("new");
}

const statusClass = (status: string) => ({
  "st-active": status === AlertStatus.Active,
  "st-inactive": status === AlertStatus.Inactive,
  "st-draft": status === AlertStatus.Draft,
});

const statusLabel = (status: string) => {
  if (status === AlertStatus.Active) return t("alertStatus.active");
  if (status === AlertStatus.Inactive) return t("alertStatus.inactive");
  return t("alertStatus.draft");
};

// First 3 characters of the alert's title, uppercased — shown next to the
// status dot when the sidebar is collapsed.
const initials = (title: string): string => {
  const t = (title ?? "").trim().slice(0, 3).toUpperCase();
  return t.length > 0 ? t : "·";
};
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-head">
      <span v-if="!collapsed" class="sidebar-title">{{
        $t("sidebar.title")
      }}</span>
      <button
        type="button"
        class="btn-icon"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-expanded="!collapsed"
        @click="toggle"
      >
        <LucideChevronLeft class="chev-icon" aria-hidden="true" />

      </button>
    </div>

    <div class="sidebar-body">
      <button
        v-for="a in alerts"
        :key="a.id ?? a.title"
        type="button"
        class="alert-row"
        :class="{ selected: a.id === selectedId }"
        :title="collapsed ? a.title : undefined"
        :disabled="disabled"
        @click="onSelect(a)"
      >
        <span
          class="status-dot"
          :class="statusClass(a.status)"
          :title="statusLabel(a.status)"
        />

        <span v-if="collapsed" class="row-initials">{{
          initials(a.title)
        }}</span>
        <span v-else class="row-title">{{ a.title }}</span>
      </button>

      <div
        v-if="alerts.length === 0 && !collapsed"
        class="sidebar-empty"
      >
        {{ disabled ? $t("sidebar.loginPrompt") : $t("sidebar.empty") }}
      </div>
      <button
        type="button"
        class="btn btn-new-bottom"
        :title="collapsed ? $t('button.newAlert') : undefined"
        :disabled="disabled"
        @click="onNew"
      >
        <LucidePlus class="plus" aria-hidden="true" /> 
        <span v-if="!collapsed" >  {{$t("button.newAlert")}}</span>
        
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-app);
  border-right: 1px solid var(--color-border-subtle);
  overflow: hidden;
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

/* ── Head ───────────────────────────────────────────────────────────
 * Expanded: title on the left, collapse-toggle on the right.
 * Collapsed: title hidden, toggle centered (only thing in the head). */
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-sidebar-head);
  border-bottom: 1px solid var(--color-border-subtle);
}
.sidebar.collapsed .sidebar-head {
  justify-content: center;
  padding: var(--space-3) 0;
}
.sidebar-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
}

/* Collapse toggle — scoped override of the global .btn-icon (which is a
 * saturated accent circle). Here we want a quieter button that reacts
 * subtly on hover instead of doing a full color inversion. */
.sidebar-head .btn-icon {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-muted);
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.sidebar-head .btn-icon:hover {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-border);
  color: var(--color-accent);
}

/* Chevron itself. Overrides the global `svg.lucide { width:1em }` from
 * reset.css and gives the icon room inside the 28-px button. Stroke ~2.25
 * reads bold without looking like a wrench. */
.chev-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.6;
  line-height: 1;
  transition: transform 0.2s ease;
}

.sidebar.collapsed .chev-icon {
  transform: rotate(180deg);
}

/* ── Body / rows ────────────────────────────────────────────────── */
.sidebar-body {
  /* Transparent so the body inherits the sidebar container's `bg-app` —
   * one continuous chrome tone from the top of the head through the row
   * list. Rows pop on hover/selected via their own backgrounds. */
  flex: 1;
  overflow-y: auto;
  padding: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-bg-panel);
  min-height: 0;

  .sidebar-collapsed & {
    padding: var(--space-1) 0;
  }
}

.alert-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  width: 100%;
  height: 30px;
  box-sizing: border-box;

  text-align: left;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);

  padding-left: 9px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-base);
  transition: background-color 0.15s;

  .sidebar-collapsed & {
    position: relative;
    justify-items: center;
    border-radius: 0;
    padding: 0;
  }
}

.alert-row:hover {
  background: var(--color-bg-card-soft);
}
.alert-row.selected {
  background: var(--color-bg-card-selected);
  color: var(--color-text-primary);
}

.row-title {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The 3-char prefix shown when collapsed.*/
.row-initials {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: inherit;
  white-space: nowrap;
  padding-right: 12px;
}

/* ── Status dots — unchanged ─────────────────────────────────────── */
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;

  .sidebar-collapsed & {
    /* 2. Status dot as an exponent in smaller size  */
    position: relative;
    bottom: 5px;
    left: 40px;
    width: 8px;
    height: 8px;
  }
}

.st-active {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
}
.st-inactive {
  background: transparent;
  border: 1px solid var(--color-text-dim);
}
.st-draft {
  background: transparent;
  border: 1px dashed var(--color-text-dim);
}

.sidebar-empty {
  color: var(--color-text-faint);
  font-size: var(--text-md);
  text-align: center;
  padding: var(--space-8) var(--space-4);
  font-style: italic;
}

/* ── New-alert button at the bottom ───────────────────────────────
 * Expanded: full pill with "+ New alert" label.
 * Collapsed: square with just "+". */
.btn-new-bottom {
  margin-top: auto;
  margin-left: var(--space-2);
  margin-right: var(--space-2);
  margin-bottom: var(--space-3);
  display: flex;
  flex-direction:row;
  align-items: center;
  padding: 9px;
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-default);
}
.btn-new-bottom:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent-border);
}
.btn-new-bottom:disabled,
.alert-row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-new-bottom:disabled:hover {
  background: var(--color-border-subtle);
  color: var(--color-text-secondary);
  border-color: var(--color-border-default);
}


.plus {
  width: 24px;
  height: 14px;
  stroke-width: 3;
  flex-shrink: 0;
}

</style>
