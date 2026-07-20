import { scheduler } from "#shared/polling/scheduler";

/**
 * Turns a cron expression into a localised human-friendly string.
 * Falls back to "Custom: <cron>" for advanced expressions.
 *
 * Used by AlertInputSummary (view-mode "Polling" row) and any other surface
 * that needs to display the polling cadence to the user. Pure: no state,
 * safe to call inside computeds.
 */
export const useScheduleLabel = () => {
  const { t } = useI18n();

  const scheduleLabel = (schedule: string | undefined | null): string => {
    if (!schedule) return t("editor.schedule.interval.empty");
    const mode = scheduler.cronToMode(schedule);
    switch (mode.unit) {
      case "minutes":
        return mode.value === 1
          ? t("editor.schedule.interval.everyMinute", { n: 1 })
          : t("editor.schedule.interval.everyMinutes", { n: mode.value });
      case "hours":
        return mode.value === 1
          ? t("editor.schedule.interval.everyHour", { n: 1 })
          : t("editor.schedule.interval.everyHours", { n: mode.value });
      case "daily":
        return t("editor.schedule.interval.dailyAt", { time: mode.dailyAt });
      case "custom":
        return `Custom: ${mode.expression}`;
    }
  };

  return { scheduleLabel };
};
