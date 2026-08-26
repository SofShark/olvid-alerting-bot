import { computed, type ComputedRef } from "vue";
import { Formatting } from "#shared/types/bundle";

/**
 * i18n-labelled format options for the bundle editor's `<Select>`.
 *
 * The list depends on the alert's source: polling alerts pick between
 * the parsed-source variants (`PollingDefault` / `PollingCustom`);
 * webhook + monitoring share the raw / simple / custom family. Kept in a
 * composable so BundleEditDialog stays render-only and useBundleEditor
 * stays translation-free (its state has no business owning UI copy).
 */
export const useBundleFormatOptions = (isPolling: ComputedRef<boolean>) => {
  const { t } = useI18n();

  const formatOptions = computed(() =>
    isPolling.value
      ? [
          {
            value: Formatting.PollingDefault,
            label: t("bundleRow.format.pollingDefault"),
          },
          {
            value: Formatting.PollingCustom,
            label: t("bundleRow.format.pollingCustom"),
          },
        ]
      : [
          {
            value: Formatting.WebhookRaw,
            label: t("bundleRow.format.unformatted"),
          },
          { value: Formatting.Simple, label: t("bundleRow.format.simple") },
          { value: Formatting.Custom, label: t("bundleRow.format.custom") },
        ],
  );

  return { formatOptions };
};
