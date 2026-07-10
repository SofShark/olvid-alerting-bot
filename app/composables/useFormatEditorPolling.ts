import { ref, computed } from "vue";
import { ConditionKind } from "#shared/types/condition";
import { PollingFormat } from "#shared/types/polling";
import { migrateCondition } from "#shared/condition/migrate";
import { getErrorMessage } from "~/utils/errors";

/**
 * Polling-side state for FormatEditor: the parsed source tree (XML/JSON
 * fetched + parsed by the server's polling engine) plus the loader.
 *
 * `watchedPaths` is derived from the alert's condition — those are the
 * paths the user already chose to watch in the condition step, surfaced
 * as quick-insert chips above the script textarea.
 *
 * Takes `getAlertParams` so the composable reads whatever the parent
 * has at call time. We don't try to type-assert PollingParams here —
 * the editor is mounted by BundleCard with the raw alertParams object
 * and only some fields are guaranteed.
 */
export const useFormatEditorPolling = (
  getAlertParams: () => Record<string, any> | null | undefined,
) => {
  const { t } = useI18n();

  const parsedTree = ref<unknown>(null);
  const pollingLoading = ref(false);
  const pollingError = ref("");

  const rootEntries = computed<Array<[string, unknown]>>(() =>
    parsedTree.value && typeof parsedTree.value === "object"
      ? Object.entries(parsedTree.value as Record<string, unknown>)
      : [],
  );

  const watchedPaths = computed<string[]>(() => {
    const c = migrateCondition(getAlertParams()?.condition);
    return c.kind === ConditionKind.Rule ? c.paths : [];
  });

  const retrievePolling = async () => {
    const params = getAlertParams() ?? {};
    const url = params.url;
    const format = params.format ?? PollingFormat.XML;
    if (!url) {
      pollingError.value = t("formatEditor.errors.noUrlPolling");
      return;
    }
    pollingLoading.value = true;
    pollingError.value = "";
    try {
      const res = await $fetch<{ ok: boolean; parsed?: unknown; error?: string }>(
        "/api/poll/retrieve",
        { method: "POST", body: { url, format } },
      );
      if (!res.ok) {
        pollingError.value =
          res.error ?? t("formatEditor.errors.failedToRetrieveSource");
        parsedTree.value = null;
      } else {
        parsedTree.value = res.parsed;
      }
    } catch (e) {
      pollingError.value = getErrorMessage(
        e,
        t("conditionEditor.errors.networkError"),
      );
    } finally {
      pollingLoading.value = false;
    }
  };

  return {
    parsedTree,
    rootEntries,
    watchedPaths,
    pollingLoading,
    pollingError,
    retrievePolling,
  };
};
