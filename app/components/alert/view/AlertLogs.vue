<script setup lang="ts">
import { toRef, computed } from "vue";
import { LogStatus, type AlertLog } from "#shared/types/statusLog";

/*
  Right-side panel of AlertView — dense timeline of the alert's most recent
  polls / webhook events. One row per event, most recent first, capped at 200.

  Each row shows: status dot · timestamp · state label. Every row is
  expandable via the leading chevron, revealing (a) the top-level error
  message when present, plus (b) a per-channel table when the run
  produced a DispatchDetails breakdown. SENT rows without any details
  stay silent — nothing to expand.

  Labels are UI-only i18n keys:
    LogStatus.Success (DB) → auth-neutral "SENT"
    LogStatus.Warning (DB) → "PARTIAL"
    LogStatus.Error   (DB) → "FAILED"
  The DB enum is unchanged — only the wording admins read is redone.
*/

const props = defineProps<{
  alertId: number | null;
}>();

const { t } = useI18n();

const { logs, isLoading, expandedIds, toggleExpanded } = useAlertLogs(
  toRef(props, "alertId"),
);

const hasLogs = computed(() => logs.value.length > 0);

// Only warning / error rows carry expandable details
function isExpandable(log: AlertLog): boolean {
  return log.status !== LogStatus.Success;
}

function isExpanded(log: AlertLog): boolean {
  return expandedIds.value.has(log.id)
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ` +
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  );
}

function stateLabel(status: string): string {
  switch (status) {
    case LogStatus.Success:
      return t("alertLog.status.sent");
    case LogStatus.Warning:
      return t("alertLog.status.partial");
    case LogStatus.Error:
      return t("alertLog.status.failed");
    default:
      return status;
  }
}
</script>

<template>
  <div class="alert-logs">
    <h4 class="alert-section-label">{{ $t("alertLog.title") }}</h4>

    <div v-if="!hasLogs && !isLoading" class="logs-empty">
      {{ $t("alertLog.empty") }}
    </div>
    <div v-else-if="!hasLogs && isLoading" class="logs-empty">
      {{ $t("common.loadingEllipsis") }}
    </div>

    <ol v-else class="logs-list">
      <li
        v-for="log in logs"
        :key="log.id"
        class="log-row"
        :class="[
          `log-${log.status}`,
          { 'is-expanded': isExpanded(log) },
        ]"
      >
        <button
          v-if="isExpandable(log)"
          type="button"
          class="log-chevron"
          :aria-expanded="expandedIds.has(log.id)"
          :title="
            isExpanded(log)
              ? $t('alertLog.hideDetails')
              : $t('alertLog.showDetails')
          "
          @click="toggleExpanded(log.id)"
        >
          <span class="chevron-icon"> ▸ </span>
        </button>
        <span v-else class="log-chevron-placeholder"/>

        <span class="log-dot" :class="`dot-${log.status}`" />
        <time class="log-time" :datetime="log.createdAt">{{
          formatTimestamp(log.createdAt)
        }}</time>
        <span class="log-state">{{ stateLabel(log.status) }}</span>

        <div
          v-if="isExpanded(log)"
          class="log-details"
          role="region"
        >
          <!-- Stage line — only shown when known. Gives immediate context
               ("this failed at fetch") without decoding the message. -->
          <p v-if="log.details?.stage" class="log-detail-line">
            <span class="log-detail-key">{{ $t("alertLog.detail.stage") }}:</span>
            <span class="log-detail-value">
              {{ $t(`alertLog.stage.${log.details.stage}`) }}
            </span>
          </p>

          <!-- Top-level error — when the run bailed before dispatch or
               the notifier threw. -->
          <pre v-if="log.error" class="log-error">{{ log.error }}</pre>

          <!-- Per-channel table — one row per output channel exercised
               in the bundle fan-out. -->
          <table
            v-if="log.details?.channels?.length"
            class="channel-table"
            :aria-label="$t('alertLog.channelsAria')"
          >
            <thead>
              <tr>
                <th>{{ $t("alertLog.channelTable.channel") }}</th>
                <th>{{ $t("alertLog.channelTable.recipients") }}</th>
                <th>{{ $t("alertLog.channelTable.outcome") }}</th>
                <th>{{ $t("alertLog.channelTable.error") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(ch, i) in log.details.channels"
                :key="i"
                :class="ch.ok ? 'channel-ok' : 'channel-fail'"
              >
                <td>{{ $t(`alertLog.channel.${ch.channel}`) }}</td>
                <td class="tabular">{{ ch.recipients }}</td>
                <td>
                  {{
                    ch.ok
                      ? $t("alertLog.channelTable.ok")
                      : $t("alertLog.channelTable.fail")
                  }}
                </td>
                <td class="channel-error">{{ ch.error ?? "" }}</td>
              </tr>
            </tbody>
          </table>

          <p v-if="!log.error && !log.details?.channels?.length" class="log-detail-line">
            {{ $t("alertLog.noAdditionalDetail") }}
          </p>
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

/* ── Empty state ────────────────────────────────────────────────────────── */
.logs-empty {
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-faint);
  font-size: var(--text-m);
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
  flex-direction: column;
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
  grid-template-columns: 10px 10px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: 4px var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-s);
  transition: background-color 0.12s ease;
}
.log-row:hover {
  background: var(--color-bg-card-soft);
}
.log-row.is-expanded {
  background: var(--color-bg-card-soft);
}

.log-chevron, 
.log-chevron-placeholder {
  width: 16px;
  height: 16px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.log-chevron {
  appearance: none;
  background: transparent;
  border: 0;
  
  margin: 0;
  padding: 0;
  cursor: pointer;
}
.log-chevron:hover {
  color: var(--color-text-primary);
}

.chevron-icon {
  color: var(--color-text-dim)
}
.log-row.is-expanded .chevron-icon {
  transform: rotate(90deg);
  color: var(--color-text-muted);
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

/* ── Expanded detail ────────────────────────────────────────────────────── */
.log-details {
  grid-column: 1 / -1;
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-border-default);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.log-warning .log-details {
  border-left-color: var(--color-warning, #f59e0b);
}
.log-error .log-details {
  border-left-color: var(--color-danger, #ef4444);
}

.log-detail-line {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
.log-detail-key {
  color: var(--color-text-muted);
  margin-right: var(--space-1);
}
.log-detail-value {
  font-family: var(--font-mono);
  color: var(--color-text-primary);
}
.log-error {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

/* ── Per-channel table ─────────────────────────────────────────────────── */
.channel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);
}
.channel-table th,
.channel-table td {
  padding: 4px var(--space-2);
  text-align: left;
  border-bottom: 1px solid var(--color-border-subtle);
}
.channel-table th {
  color: var(--color-text-muted);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-size: 10px;
}
.tabular {
  font-variant-numeric: tabular-nums;
}
.channel-ok td {
  color: var(--color-text-secondary);
}
.channel-fail td {
  color: var(--color-danger-text, var(--color-danger));
}
.channel-error {
  font-family: var(--font-mono);
  word-break: break-word;
}
</style>
