import type { StatusMatch } from "#shared/types/monitor";

/**
 * Human-readable one-liner for a `StatusMatch`, used by the view-mode
 * `AlertInputSummary` for Monitoring alerts. Parallel to
 * `useScheduleLabel` — pure, no state, safe inside computeds.
 *
 * Falls back to a dash when the match is undefined (draft alerts).
 */
export const useStatusMatchLabel = () => {
  const { t } = useI18n();

  const statusMatchLabel = (match: StatusMatch | undefined | null): string => {
    if (!match) return "—";
    switch (match.kind) {
      case "codes":
        return t("monitorEditor.view.codes", {
          codes: match.codes.length > 0 ? match.codes.join(", ") : "—",
        });
      case "range":
        return t("monitorEditor.view.range", { range: match.range });
      case "not-ok":
        return t("monitorEditor.view.notOk");
    }
  };

  return { statusMatchLabel };
};
