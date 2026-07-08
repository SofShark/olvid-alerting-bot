<script setup lang="ts">
import { computed } from "vue";

/*
  Source-pane host. Three render modes:
    - polling           → XML tree of the fetched source
    - webhook + picker  → JSON tree (click-to-insert)
    - webhook (default) → JSON textarea (editable)

  Owns no state; everything routes back to the container via emits. The
  toolbar (webhook only) is composed in here so the panel header stays
  a single `<div class="code-header">` row.
*/

const props = defineProps<{
  isPolling: boolean;
  pickerMode: boolean;
  format: string;
  // Polling state
  pollingLoading: boolean;
  pollingError: string;
  rootEntries: Array<[string, unknown]>;
  // Webhook state
  jsonPayload: string;
  jsonRootEntries: Array<[string, unknown]>;
  lastPayloadLoading: boolean;
  lastPayloadMissing: boolean;
  // Toolbar state
  loadOpen: boolean;
}>();

defineEmits<{
  (e: "update:jsonPayload", v: string): void;
  (e: "select-path", path: string): void;
  (e: "retrieve"): void;
  (e: "open-load", anchor: DOMRect): void;
  (e: "toggle-picker"): void;
  (e: "prettify"): void;
  (e: "clear"): void;
}>();


const parsedJson = computed(() => {
  try {
    return JSON.parse(props.jsonPayload);
  } catch {
    return null;
  }
});
</script>

<template>
  <div class="code-block">
    <div class="code-header">
      <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
      <span class="code-title">
        {{ isPolling
          ? $t("formatEditor.sourceTitlePollingFormat", { format: (format ?? "xml").toLowerCase() })
          : "payload.json (Test Data)" }}
      </span>

      <button
        v-if="isPolling"
        type="button"
        class="payload-refresh"
        :disabled="pollingLoading"
        :title="$t('formatEditor.sourceRefreshTitle')"
        @click="$emit('retrieve')"
      >{{ pollingLoading ? "…" : "⟳" }}</button>

      <PayloadToolbar
        v-else
        :load-open="loadOpen"
        @open-load="(rect) => $emit('open-load', rect)"
        @toggle-picker="$emit('toggle-picker')"
        @prettify="$emit('prettify')"
        @clear="$emit('clear')"
      />
    </div>

    <!-- Polling: XML tree -->
    <template v-if="isPolling">
      <div v-if="pollingLoading" class="payload-notice">
        {{ $t("formatEditor.sourceLoadingPolling") }}
      </div>
      <div v-else-if="pollingError" class="payload-empty">⚠ {{ pollingError }}</div>
      <div v-else-if="rootEntries.length === 0" class="payload-empty">
        {{ $t("formatEditor.sourceEmptyPolling") }}
      </div>
      <div v-else class="tree-panel">
        <XmlTreeNode
          v-for="[k, v] in rootEntries"
          :key="k"
          :node-name="k"
          :node-value="v"
          :path="k"
          :selected="[]"
          @select="$emit('select-path', $event)"
        />
      </div>
    </template>

    <!-- Webhook + picker mode: JSON tree -->
    <template v-else-if="pickerMode">
      <div v-if="lastPayloadLoading" class="payload-notice">
        {{ $t("formatEditor.sourceLoadingWebhook") }}
      </div>
      <div v-else-if="lastPayloadMissing" class="payload-empty">
        {{ $t("formatEditor.sourceNoPayloads") }}
      </div>
      <div v-else class="tree-panel">
        <JsonTreeNode
          node-name=""
          :node-value="parsedJson"
          path=""
          :is-root="true"
          @select="$emit('select-path', $event)"
        />

      </div>
    </template>

    <!-- Webhook default: JSON textarea -->
    <template v-else>
      <div v-if="lastPayloadLoading" class="payload-notice">
        {{ $t("formatEditor.sourceLoadingWebhook") }}
      </div>
      <div v-else-if="lastPayloadMissing" class="payload-empty">
        {{ $t("formatEditor.sourceNoPayloads") }}
      </div>
      <textarea
        v-else
        :value="jsonPayload"
        class="editor-textarea json-color"
        spellcheck="false"
        @input="$emit('update:jsonPayload', ($event.target as HTMLTextAreaElement).value)"
      />
    </template>
  </div>
</template>

<style scoped>
/* Refresh button — small chrome action, polling-only. */
.payload-refresh {
  background: #3a3a3a;
  color: #a3a3a3;
  border: 1px solid #555;
  width: 28px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-lg);
  cursor: pointer;
  margin-left: auto;
}
.payload-refresh:hover:not(:disabled) {
  background: #4a4a4a;
  color: var(--color-text-on-accent);
}
.payload-refresh:disabled {
  opacity: 0.4;
  cursor: wait;
}
</style>
