import { Formatting, type BundleModel } from "#shared/types/bundle";

/**
 * Per-bundle readiness signal. Three states:
 *
 *   - `ready`     — at least one destination AND any required script is set.
 *   - `no-dest`   — no discussion picked → bundle wouldn't deliver anywhere.
 *   - `no-script` — Custom-format bundle with an empty script → would render blank.
 *
 * Used by the view-mode bundle table (status pip next to the title) and any
 * future "incomplete bundles" warning. Labels are pulled from i18n so callers
 * can render them directly in the UI.
 */
export type BundleStatusKind = "ready" | "no-dest" | "no-script";
export type BundleStatus = { kind: BundleStatusKind; label: string };

export const useBundleStatus = () => {
  const { t } = useI18n();
  const bundleStatus = (b: BundleModel): BundleStatus => {
    if (b.outputs.length === 0) {
      return { kind: "no-dest", label: t("bundleRow.status.noDestinations") };
    }
    const needsScript =
      b.formating === Formatting.Custom ||
      b.formating === Formatting.PollingCustom;
    if (needsScript && !(b.custom_script ?? "").trim()) {
      return { kind: "no-script", label: t("bundleRow.status.noScript") };
    }
    return { kind: "ready", label: t("bundleRow.status.ready") };
  };

  return { bundleStatus };
};
