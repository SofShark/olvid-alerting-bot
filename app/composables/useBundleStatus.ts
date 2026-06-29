import { Formatting, type BundleModel } from "#shared/types/bundle";

/**
 * Per-bundle readiness signal. Three states:
 *
 *   - `ready`     — at least one destination AND any required script is set.
 *   - `no-dest`   — no discussion picked → bundle wouldn't deliver anywhere.
 *   - `no-script` — Custom-format bundle with an empty script → would render blank.
 *
 * Used by the view-mode bundle table (status pip next to the title) and any
 * future "incomplete bundles" warning. Pure — no i18n yet; labels are
 * English text. If you need translated labels later, wire them via
 * `useI18n()` here.
 */
export type BundleStatusKind = "ready" | "no-dest" | "no-script";
export type BundleStatus = { kind: BundleStatusKind; label: string };

export const useBundleStatus = () => {
  const bundleStatus = (b: BundleModel): BundleStatus => {
    if (b.discussion_list.length === 0) {
      return { kind: "no-dest", label: "No destinations" };
    }
    const needsScript =
      b.formating === Formatting.Custom ||
      b.formating === Formatting.PollingCustom;
    if (needsScript && !(b.custom_script ?? "").trim()) {
      return { kind: "no-script", label: "Custom format set but no script" };
    }
    return { kind: "ready", label: "Ready" };
  };

  return { bundleStatus };
};
