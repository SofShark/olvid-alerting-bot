import { ref, computed } from "vue";
import {
  webhookTemplateList,
  getWebhookPayloadJson,
  getWebhookScript,
  type WebhookTemplate,
} from "#shared/payloadTemplates";

/**
 * Webhook-side state for FormatEditor: the JSON payload textarea, the parsed
 * tree shown by the JSON picker, and the loaders that fill the payload from
 * either the alert's last DB record or the bundled template library.
 *
 * Reads the alert id lazily via `getAlertId` so the composable doesn't
 * capture stale props — the editor is mounted fresh on every open, but
 * the alert id can be null (brand-new alert) and we need to surface that.
 *
 * `loadLibraryPayload` returns the matching Handlebars script when the
 * user confirms applying the template's script too. The container decides
 * what to do with that string (typically: writes it to `scriptContent`).
 * Keeping the confirm flow here means the policy ("payload + ask about
 * script") lives in one file instead of being split across composable +
 * container.
 */
export const useFormatEditorPayload = (
  getAlertId: () => number | null,
) => {
  const jsonPayload = ref("{}");
  const lastPayloadLoading = ref(false);
  const lastPayloadMissing = ref(false);

  const parsedJson = computed<unknown | null>(() => {
    if (!jsonPayload.value.trim()) return null;
    try {
      return JSON.parse(jsonPayload.value);
    } catch {
      return null;
    }
  });

  const jsonRootEntries = computed<Array<[string, unknown]>>(() => {
    const p = parsedJson.value;
    if (!p || typeof p !== "object") return [];
    return Array.isArray(p)
      ? p.map((v, i) => [String(i), v])
      : Object.entries(p as Record<string, unknown>);
  });

  const formatJson = () => {
    try {
      if (!jsonPayload.value.trim()) return;
      jsonPayload.value = JSON.stringify(JSON.parse(jsonPayload.value), null, 2);
    } catch {
      alert("Invalid JSON: Cannot prettify.");
    }
  };

  const clearPayloadPanel = () => {
    jsonPayload.value = "{}";
    lastPayloadMissing.value = false;
  };

  /**
   * Pulls the alert's most recent payload from the server.
   * `type=success` → last successful poll, `type=failed` → last failure.
   * Both responses share `{ payload }` shape; missing payload sets
   * `lastPayloadMissing = true` so the panel can render its empty state.
   */
  const loadLastPayload = async (type: "success" | "failed") => {
    const alertId = getAlertId();
    if (!alertId) {
      alert("This alert hasn't been saved yet. No payloads in database.");
      return;
    }
    lastPayloadLoading.value = true;
    lastPayloadMissing.value = false;
    try {
      const res = await $fetch<{ payload: unknown }>(
        `/api/payloads?type=${type}&alertId=${alertId}`,
      );
      if (res.payload) {
        jsonPayload.value = JSON.stringify(res.payload, null, 2);
      } else {
        lastPayloadMissing.value = true;
        jsonPayload.value = "";
      }
    } catch {
      lastPayloadMissing.value = true;
      jsonPayload.value = "";
    } finally {
      lastPayloadLoading.value = false;
    }
  };

  /**
   * Fill the JSON panel from the bundled template registry. Returns the
   * matching Handlebars script when the user confirms applying it too,
   * otherwise null — the container decides whether to write `scriptContent`.
   */
  const loadLibraryPayload = (id: WebhookTemplate["id"]): string | null => {
    const payloadJson = getWebhookPayloadJson(id);
    if (payloadJson === null) return null;
    jsonPayload.value = payloadJson;
    lastPayloadMissing.value = false;
    const script = getWebhookScript(id);
    if (!script) return null;
    const label = webhookTemplateList.find((t) => t.id === id)?.label ?? id;
    return window.confirm(
      `Loaded the ${label} payload. Apply its matching Handlebars template too? (This overwrites your current script.)`,
    )
      ? script
      : null;
  };

  return {
    jsonPayload,
    parsedJson,
    jsonRootEntries,
    lastPayloadLoading,
    lastPayloadMissing,
    formatJson,
    clearPayloadPanel,
    loadLastPayload,
    loadLibraryPayload,
  };
};
