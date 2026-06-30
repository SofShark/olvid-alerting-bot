import { scheduler } from "#shared/polling/scheduler";

/**
 * Turns a cron expression into a localised "Every N minutes" / "Daily at HH:MM"
 * string. Uses `cronToMode` to classify the cron into one of the wizard's
 * friendly modes; falls back to "Custom: <cron>" for advanced expressions.
 *
 * Used by AlertInputSummary (view-mode "Polling" row) and any other surface
 * that needs to display the polling cadence to the user. Pure: no state,
 * safe to call inside computeds.
 */
export const useScheduleLabel = () => {
  const { t } = useI18n();

  const scheduleLabel = (schedule: string | undefined | null): string => {
    if (!schedule) return t("editor.interval.empty");
    const mode = scheduler.cronToMode(schedule);
    switch (mode.unit) {
      case "minutes":
        return mode.value === 1
          ? t("editor.interval.everyMinute", { n: 1 })
          : t("editor.interval.everyMinutes", { n: mode.value });
      case "hours":
        return mode.value === 1
          ? t("editor.interval.everyHour", { n: 1 })
          : t("editor.interval.everyHours", { n: mode.value });
      case "daily":
        return t("editor.interval.dailyAt", { time: mode.dailyAt });
      case "custom":
        return `Custom: ${mode.expression}`;
    }
  };

  return { scheduleLabel };
};
