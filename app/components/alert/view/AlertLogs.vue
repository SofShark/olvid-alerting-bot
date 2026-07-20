<script setup lang="ts">
import { toRef, computed } from "vue";
import { LogStatus, type AlertLog } from "#shared/types/statusLog";

/*
  Right-side panel of AlertView — dense timeline of the alert's most recent
  polls. One row per event, most recent first, capped at 200.

  Each row shows: status dot · timestamp · state label. Non-success rows
  can be expanded via the leading chevron to reveal the error message.
  Success rows have no chevron and no additional info to reveal — they're
  the silent heartbeat that says "the alert is alive".
*/

const props = defineProps<{
  alertId: number | null;
}>();

const { logs, isLoading, expandedIds, toggleExpanded } = useAlertLogs(
  toRef(props, "alertId"),
);

const hasLogs = computed(() => logs.value.length > 0);
const isExpandable = (log: AlertLog) => log.status !== LogStatus.Success;

// Format matches the mockup: "HH:MM:SS DD/MM/YYYY". Locale-independent so
// admins reading logs across timezones see the same shape.
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ` +
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  );
}

// Human-friendly state label. Capitalises the raw enum value.
function stateLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
</script>

<template>
  <div class="alert-logs">
    <h4 class="section-eyebrow">Status logs</h4>

    <div v-if="!hasLogs && !isLoading" class="logs-empty">
      No polls recorded yet.
    </div>
    <div v-else-if="!hasLogs && isLoading" class="logs-empty">Loading…</div>

    <ol v-else class="logs-list">
      <li
        v-for="log in logs"
        :key="log.id"
        class="log-row"
        :class="[
          `log-${log.status}`,
          { 'is-expanded': expandedIds.has(log.id) },
        ]"
      >
        <button
          v-if="isExpandable(log)"
          type="button"
          class="log-chevron"
          :aria-expanded="expandedIds.has(log.id)"
          :title="expandedIds.has(log.id) ? 'Hide details' : 'Show details'"
          @click="toggleExpanded(log.id)"
        >
          ▸
        </button>
        <span v-else class="log-chevron-placeholder" aria-hidden="true" />

        <span class="log-dot" :class="`dot-${log.status}`" aria-hidden="true" />
        <time class="log-time" :datetime="log.createdAt">{{
          formatTimestamp(log.createdAt)
        }}</time>
        <span class="log-state">{{ stateLabel(log.status) }}</span>

        <div
          v-if="isExpandable(log) && expandedIds.has(log.id)"
          class="log-details"
          role="region"
        >
          <pre class="log-error">{{ log.error || "(no message)" }}</pre>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.alert-logs {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-eyebrow {
  margin: 0 0 var(--space-3);
  padding: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

/* ── Empty state ────────────────────────────────────────────────────────── */
.logs-empty {
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-faint);
  font-size: var(--text-md);
  font-style: italic;
  text-align: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

/* ── List ───────────────────────────────────────────────────────────────── */
.logs-list {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column /*-reverse*/;
  gap: 2px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

/* ── Row ────────────────────────────────────────────────────────────────── */
.log-row {
  display: grid;
  grid-template-columns: 20px 10px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  transition: background-color 0.12s ease;
}
.log-row:hover {
  background: var(--color-bg-card-soft);
}
.log-row.is-expanded {
  background: var(--color-bg-card-soft);
}

/* Chevron rotates on expand. Placeholder keeps the grid column aligned
 * for success rows (no chevron shown). */
.log-chevron {
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-faint);
  font-size: var(--text-base);
  line-height: 1;
  transition:
    transform 0.15s ease,
    color 0.12s ease;
}
.log-chevron:hover {
  color: var(--color-text-primary);
}
.log-row.is-expanded .log-chevron {
  transform: rotate(90deg);
  color: var(--color-text-primary);
}
.log-chevron-placeholder {
  display: inline-block;
  width: 100%;
}

/* ── Status dot ─────────────────────────────────────────────────────────── */
.log-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  justify-self: center;
}
.dot-success {
  background: var(--color-success, #22c55e);
}
.dot-warning {
  background: var(--color-warning, #f59e0b);
}
.dot-error {
  background: var(--color-danger, #ef4444);
}

/* ── Timestamp + state ──────────────────────────────────────────────────── */
.log-time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-dim);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.log-state {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  justify-self: end;
}
.log-success .log-state {
  color: var(--color-text-faint);
}
.log-warning .log-state {
  color: var(--color-warning-text, #b45309);
}
.log-error .log-state {
  color: var(--color-danger-text, #b91c1c);
}

/* ── Expanded detail (error message) ────────────────────────────────────── */
.log-details {
  grid-column: 1 / -1;
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-danger, #ef4444);
}
.log-warning .log-details {
  border-left-color: var(--color-warning, #f59e0b);
}
.log-error .log-details {
  border-left-color: var(--color-danger, #ef4444);
}
.log-error-pre,
.log-error {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}
</style>
