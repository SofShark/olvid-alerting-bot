import { Formatting } from "#shared/types/bundle";

/**
 * Translates a `Formatting` enum value into its human-readable label
 * (via i18n). Centralises the switch that was duplicated across
 * AlertEditor, BundleCard and TestPoll — change a label once, every
 * caller picks it up.
 *
 * Returns a stable function, not a computed: callers usually evaluate
 * it inline against changing values (`formatLabel(b.formating)`).
 */
export const useFormatLabel = () => {
  const { t } = useI18n();

  const formatLabel = (f: Formatting | string): string => {
    switch (f) {
      case Formatting.Unformatted:
        return t("bundleCard.format.unformatted");
      case Formatting.Simple:
        return t("bundleCard.format.simple");
      case Formatting.Custom:
        return t("bundleCard.format.custom");
      case Formatting.PollingDefault:
        return t("bundleCard.format.pollingDefault");
      case Formatting.PollingCustom:
        return t("bundleCard.format.pollingCustom");
      default:
        return String(f);
    }
  };

  return { formatLabel };
};
