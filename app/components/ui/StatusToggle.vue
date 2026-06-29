<script setup lang="ts">
import { AlertStatus } from "#shared/types/alert";
// defineModel remplace à la fois la prop 'status' et l'emit associé !

const status = defineModel<AlertStatus>("status", { required: true });

const props = defineProps<{
  canActivate: boolean;
}>();

const { t } = useI18n();

// TODO RECYCLE
const statusLabel = computed(() => {
  if (status.value === AlertStatus.Active) return t("alertStatus.active");
  if (status.value === AlertStatus.Inactive) return t("alertStatus.inactive");
  return t("alertStatus.draft");
});

const emit = defineEmits(["update:state"]);

const toggleStatus = () => {
  console.log("toggle toggle");
  emit("update:state");
};
</script>
<template>
  <div class="toggle-wrap">
    <span class="toggle-label">{{ statusLabel }}</span>
    <button
      type="button"
      class="toggle"
      :class="{ on: status === AlertStatus.Active }"
      :disabled="!canActivate"
      @click="toggleStatus"
    >
      <span class="knob"></span>
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
  font-size: var(--text-md);
  color: var(--color-text-muted);
  font-weight: 600;
  min-width: 54px;
}
</style>
