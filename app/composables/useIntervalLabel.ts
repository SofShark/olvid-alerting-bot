/**
 * Turns an `intervalSeconds` value into a localised "Every N <unit>" string.
 *
 * The function is unit-aware: it picks days / hours / minutes / seconds
 * based on the largest unit that divides evenly. Plural keys are selected
 * automatically (1 → singular, N → plural).
 *
 * Used by AlertEditor (view-mode "Polling" row) and anything else that
 * needs to display a polling interval to the user. Pure: no state, no
 * side-effects — safe to call inside computeds.
 */
export const useIntervalLabel = () => {
  const { t } = useI18n()

  const intervalLabel = (intervalSeconds: number | undefined | null): string => {
    const s = Number(intervalSeconds ?? 0)
    if (!s) return t('editor.interval.empty')

    if (s % 86_400 === 0) {
      const d = s / 86_400
      return t(d === 1 ? 'editor.interval.everyDay' : 'editor.interval.everyDays', { n: d })
    }
    if (s % 3_600 === 0) {
      const h = s / 3_600
      return t(h === 1 ? 'editor.interval.everyHour' : 'editor.interval.everyHours', { n: h })
    }
    if (s % 60 === 0) {
      const m = s / 60
      return t(m === 1 ? 'editor.interval.everyMinute' : 'editor.interval.everyMinutes', { n: m })
    }
    return t('editor.interval.everySeconds', { n: s })
  }

  return { intervalLabel }
}
