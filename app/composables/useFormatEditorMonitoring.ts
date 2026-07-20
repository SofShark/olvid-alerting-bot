import { ref, computed } from "vue";
import { getErrorMessage } from "~/utils/errors";
import type { MonitorProbePayload } from "#shared/types/monitor";
/**
 * Monitoring-side state for FormatEditor: fetches a single probe of the
 * monitor's URL and exposes it as a plain object so JsonTreeNodeExp can
 * render it click-to-insert-style.
 *
 * The probe shape mirrors what the runtime dispatcher hands to the
 * notifier — see `MonitorProbePayload` in
 * `server/services/dispatchers/monitoringStrategy.ts`:
 *
 *   { status: 404, url: "…", body: "…", latencyMs: 123 }
 *
 * Body is truncated to the same MONITOR_BODY_PREVIEW_MAX limit as the
 * runtime — the editor preview is honest about what templates will
 * actually receive.
 *
 * No template library for monitoring (no reference payloads exist), so
 * this composable exposes NO `loadLibraryPayload` counterpart — the
 * container hides the Load Templates button on the monitoring branch.
 */

export const useFormatEditorMonitoring = (
  getAlertParams: () => Record<string, any> | null | undefined,
) => {
  const { t } = useI18n();

  const probe = ref<MonitorProbePayload | null>(null);
  const monitorLoading = ref(false);
  const monitorError = ref("");

  /** Root-level [key, value] pairs for JsonTreeNodeExp iteration.
   *  Empty until the first successful retrieve. */
  const rootEntries = computed<Array<[string, unknown]>>(() =>
    probe.value ? Object.entries(probe.value) : [],
  );

  async function retrieveMonitor() {
    const url = ((getAlertParams()?.url as string | undefined) ?? "").trim();
    if (!url) {
      monitorError.value = t("formatEditor.errors.noUrlMonitoring");
      probe.value = null;
      return;
    }
    monitorLoading.value = true;
    monitorError.value = "";
    try {
      const res = await $fetch<
        { ok: true; probe: MonitorProbePayload } | { ok: false; error: string }
      >("/api/monitor/probe", { method: "POST", body: { url } });
      if (!res.ok) {
        monitorError.value =
          res.error ?? t("formatEditor.errors.failedToProbeMonitor");
        probe.value = null;
      } else {
        probe.value = res.probe;
      }
    } catch (e) {
      monitorError.value = getErrorMessage(
        e,
        t("conditionEditor.errors.networkError"),
      );
      probe.value = null;
    } finally {
      monitorLoading.value = false;
    }
  }

  return {
    probe,
    rootEntries,
    monitorLoading,
    monitorError,
    retrieveMonitor,
  };
};
