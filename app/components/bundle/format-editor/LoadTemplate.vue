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
        <div class="template-section-label">
          {{ $t("formatEditor.templates.fromDatabase") }}
        </div>
        <button class="template-item" @click="$emit('select-last', 'success')">
          <span class="status-pip pip-ok" aria-hidden="true" />
          <span class="template-item-label">
            {{ $t("formatEditor.templates.lastSuccess") }}
          </span>
        </button>
        <button class="template-item" @click="$emit('select-last', 'failed')">
          <span class="status-pip pip-fail" aria-hidden="true" />
          <span class="template-item-label">
            {{ $t("formatEditor.templates.lastFailed") }}
          </span>
        </button>
      </div>
      <div class="template-section">
        <div class="template-section-label">
          {{ $t("formatEditor.templates.fromLibrary") }}
        </div>
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
/* All chrome tokenised — the dropdown reads on the same "menu" surface
 * as AccountMenu / DiscussionSelector / other floating pickers. */
.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10509;
}
.template-dropdown {
  min-width: 260px;
  padding: var(--space-2) 0;
  background: var(--color-bg-menu);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
  font-family: inherit;
}
.template-section {
  padding: var(--space-1) 0 var(--space-2);
}
.template-section + .template-section {
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 2px;
  padding-top: var(--space-3);
}
.template-section-label {
  padding: var(--space-1) var(--space-6) var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.template-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-6) var(--space-3) var(--space-6);
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  border-left: 2px solid transparent;
  text-align: left;
  font-family: inherit;
  font-size: var(--text-base);
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    border-color 0.12s ease;
}
.template-item:hover,
.template-item:focus-visible {
  outline: none;
  background: var(--color-bg-card-soft);
  color: var(--color-text-primary);
  border-left-color: var(--color-accent);
}
.template-item-label {
  flex: 1;
  min-width: 0;
}

.status-pip {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--color-border-subtle);
}
.pip-ok {
  background: var(--color-success);
}
.pip-fail {
  background: var(--color-danger);
}
</style>
