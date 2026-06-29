import { ref } from 'vue'
import { AlertStatus, type AlertModel } from '#shared/types/alert'
import { alertService } from '~/utils/alertService'

/**
 * Side-effecting actions: persist / delete / toggle. Wrappers around
 * `alertService` so containers don't import the service directly. Keeps the
 * imperative HTTP-shaped surface in one place — easy to swap for a Pinia
 * store or to mock in tests.
 *
 * `saving` is exposed so consumers can disable buttons / show spinners
 * without bookkeeping their own ref.
 */
export const useAlertActions = () => {
  const saving = ref(false)

  const saveAlert = async (payload: any, opts: { isExisting: boolean }) => {
    saving.value = true
    try {
      const res: any = opts.isExisting
        ? await alertService.updateAlert(payload)
        : await alertService.saveAlert(payload)
      return res?.data as AlertModel | undefined
    } finally {
      saving.value = false
    }
  }

  const deleteAlert = async (id: number) => {
    return alertService.delete(id)
  }

  const setStatus = async (id: number, status: AlertStatus) => {
    const res: any = await alertService.setStatus(id, status)
    return (res?.data?.status ?? status) as AlertStatus
  }

  return {
    saving,
    saveAlert,
    deleteAlert,
    setStatus,
  }
}
