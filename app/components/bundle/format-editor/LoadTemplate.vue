<script setup lang="ts">
import { computed } from "vue";
import { webhookTemplateList } from "#shared/payloadTemplates";

/*
  Teleported "Load Template" dropdown. Two sections:
    - From database — last successful / last failed payload
    - From library  — bundled templates (GitHub Push, etc.)

  Positions itself from the trigger button's DOMRect (passed by the
  container). Teleported to <body> so the parent's overflow:hidden
  doesn't clip it. Internal backdrop swallows outside clicks.
*/

const props = defineProps<{
  open: boolean;
  anchor: DOMRect | null;
}>();

defineEmits<{
  (e: "select-last", type: "success" | "failed"): void;
  (e: "select-template", id: string): void;
  (e: "close"): void;
}>();

const positionStyle = computed<Record<string, string>>(() => {
  if (!props.anchor) return {} as Record<string, string>;
  return {
    position: "fixed",
    top: `${props.anchor.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - props.anchor.right)}px`,
    "z-index": "10510",
  };
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dropdown-backdrop" @click="$emit('close')" />
    <div v-if="open" class="template-dropdown" :style="positionStyle">
      <div class="template-section">
        <div class="template-section-label">From database</div>
        <button class="template-item" @click="$emit('select-last', 'success')">
          <span class="status-pip pip-ok" aria-hidden="true" />
          <span class="template-item-label">Last successful payload</span>
        </button>
        <button class="template-item" @click="$emit('select-last', 'failed')">
          <span class="status-pip pip-fail" aria-hidden="true" />
          <span class="template-item-label">Last failed payload</span>
        </button>
      </div>
      <div class="template-section">
        <div class="template-section-label">From library</div>
        <button
          v-for="tpl in webhookTemplateList"
          :key="tpl.id"
          class="template-item"
          @click="$emit('select-template', tpl.id)"
        >
          <span class="template-item-label">{{ tpl.label }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10509;
}
.template-dropdown {
  min-width: 260px;
  padding: 6px 0;
  background: #1e1e22;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 12px 32px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  font-family: inherit;
}
.template-section {
  padding: 4px 0 6px;
}
.template-section + .template-section {
  border-top: 1px solid #2c2c30;
  margin-top: 2px;
  padding-top: 8px;
}
.template-section-label {
  padding: 4px 16px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: #71717a;
}
.template-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 16px 8px 18px;
  background: transparent;
  color: #d4d4d8;
  border: none;
  border-left: 2px solid transparent;
  text-align: left;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    border-color 0.12s ease;
}
.template-item:hover,
.template-item:focus-visible {
  outline: none;
  background: #2a2a30;
  color: #fff;
  border-left-color: var(--color-accent, #3b82f6);
}
.template-item-label {
  flex: 1;
  min-width: 0;
}

.status-pip {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.04);
}
.pip-ok {
  background: #22c55e;
}
.pip-fail {
  background: #ef4444;
}
</style>
