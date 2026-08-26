<script setup lang="ts">
import { AlertStatus } from "#shared/types/alert";

// One-way prop + one event. The parent owns the status; a click here just
// asks for a flip. Previously wired via defineModel("status") which forced
// callers to expose a writable ref even when the flip is a server round-
// trip anyway — the `update:state` event was already the real write path.
const props = defineProps<{
  status: AlertStatus;
  canActivate: boolean;
}>();

const emit = defineEmits<{ (e: "update:state"): void }>();

const { t } = useI18n();

const label = computed(() => {
  if (props.status === AlertStatus.Active) return t("alertStatus.active");
  if (props.status === AlertStatus.Inactive) return t("alertStatus.inactive");
  return t("alertStatus.draft");
});

const toggleStatus = () => emit("update:state");
</script>
<template>
  <div class="toggle-wrap">
    <span class="toggle-label">{{ label }}</span>
    <button
      type="button"
      class="toggle"
      :class="{ on: status === AlertStatus.Active }"
      :disabled="!canActivate"
      @click="toggleStatus"
    >
      <span class="knob" />
    </button>
  </div>
</template>
<style>
/* ── Active/inactive toggle ─────────────────────── */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 0;
}
.toggle {
  width: 42px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border-default);
  border: none;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  padding: 0;
}
.toggle.on {
  background: var(--color-accent);
}
.toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-on-accent);
  transition: transform 0.2s;
}
.toggle.on .knob {
  transform: translateX(20px);
}
.toggle-label {
  font-size: var(--text-m);
  color: var(--color-text-muted);
  font-weight: 600;
  min-width: 54px;
}
</style>
