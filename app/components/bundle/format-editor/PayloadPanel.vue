<script setup lang="ts">
import { computed } from "vue";

/*
  Four render modes, dispatched by source:
    - polling           → payload interactive tree of the fetched source (⟳ refresh)
    - monitoring        → JSON interactivetree of the probe result   (⟳ refresh)
    - webhook + picker  → JSON interactive tree of last received payload
    - webhook (default) → editable JSON textarea (to alllow copy/paste or manual edits)

  Owns no state; everything routes back to the container via emits.
*/

const props = defineProps<{
  isPolling: boolean;
  isMonitoring: boolean;
  pickerMode: boolean;
  format: string;
  // Polling state
  pollingLoading: boolean;
  pollingError: string;
  rootEntries: Array<[string, unknown]>;
  // Monitoring state — the probe payload is a flat object
  //   { status, url, body, latencyMs }
  // ready to be rendered by JsonTreeNodeExp.
  monitorLoading: boolean;
  monitorError: string;
  monitorProbe: unknown;
  monitorRootEntries: Array<[string, unknown]>;
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
  (e: "retrieve-monitor"): void;
  (e: "toggle-load"): void;
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
      <span class="dot dot-red" /><span class="dot dot-yellow" /><span
        class="dot dot-green"
      />
      <span class="code-title">
        <template v-if="isPolling">
          {{
            $t("formatEditor.sourceTitlePollingFormat", {
              format: (format ?? "xml").toLowerCase(),
            })
          }}
        </template>
        <template v-else-if="isMonitoring">{{ $t("formatEditor.sourceTitleMonitor") }}</template>
        <template v-else>{{ $t("formatEditor.sourceTitleWebhook") }}</template>
      </span>

      <!-- Polling + Monitoring share the same refresh affordance: a plain
           ⟳ button. Webhook keeps the richer PayloadToolbar because it
           has the Load Templates dropdown + prettify + clear. -->
      <button
        v-if="isPolling"
        type="button"
        class="payload-refresh"
        :disabled="pollingLoading"
        :title="$t('formatEditor.sourceRefreshTitle')"
        @click="$emit('retrieve')"
      >
        {{ pollingLoading ? "…" : "⟳" }}
      </button>

      <button
        v-else-if="isMonitoring"
        type="button"
        class="payload-refresh"
        :disabled="monitorLoading"
        :title="$t('formatEditor.monitorProbeTitle')"
        @click="$emit('retrieve-monitor')"
      >
        {{ monitorLoading ? "…" : "⟳" }}
      </button>

      <PayloadToolbar
        v-else
        :load-open="loadOpen"
        @toggle-load="$emit('toggle-load')"
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
      <div v-else-if="pollingError" class="payload-empty">
        ⚠ {{ pollingError }}
      </div>
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

    <!-- Monitoring: JSON tree over the probe result. No templates to
         load, no picker toggle — click-to-insert is always on because
         there are only four fields (status / url / body / latencyMs) and
         a textarea would be strictly worse. -->
    <template v-else-if="isMonitoring">
      <div v-if="monitorLoading" class="payload-notice">
        {{ $t("formatEditor.sourceLoadingMonitor") }}
      </div>
      <div v-else-if="monitorError" class="payload-empty">
        ⚠ {{ monitorError }}
      </div>
      <div v-else-if="!monitorProbe" class="payload-empty">
        {{ $t("formatEditor.sourceEmptyMonitor") }}
      </div>
      <div v-else class="tree-panel">
        <JsonTreeNode
          node-name=""
          :node-value="monitorProbe"
          path=""
          :is-root="true"
          @select="$emit('select-path', $event)"
        />
      </div>
    </template>

    <!-- Webhook + picker mode: JSON tree of the last received payload. -->
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
        @input="
          $emit(
            'update:jsonPayload',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </template>
  </div>
</template>

<style scoped>

/* Refresh button — small chrome action, shared by polling + monitoring.
 * Tokenised over the previous hard-coded hex ladder so the button reads
 * like every other chrome control (bundle picker, payload toolbar). */
.payload-refresh {
  background: var(--color-bg-menu);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-default);
  width: 28px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-lg);
  cursor: pointer;
  margin-left: auto;
  transition:
    background-color 0.12s,
    color 0.12s,
    border-color 0.12s;
}
.payload-refresh:hover:not(:disabled) {
  background: var(--color-bg-card-soft);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
.payload-refresh:disabled {
  opacity: 0.4;
  cursor: wait;
}
</style>
