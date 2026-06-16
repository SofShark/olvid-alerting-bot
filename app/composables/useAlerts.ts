import type { AlertModel, DiscussionModel } from '#shared/constants'
import { alertService } from '~/utils/alertService'

/*Why useState instead of Vue's standard ref?
If you just used const alerts = ref([]), the state would be localized to the specific component. 
Furthermore, in an SSR environment like Nuxt, using ref for global state can cause memory leaks
across different users' requests or cause the client browser to lose the data the server just fetched. 
useState solves both problems by caching the data under the unique string key. */


export const useAlerts = () => {
  const alerts               = useState<AlertModel[]>('alerts',              () => [])
  const availableDiscussions = useState<DiscussionModel[]>('discussions',    () => [])
  const discussionsLoading   = useState<boolean>('discussionsLoading',       () => true)
  const alertsLoading        = useState<boolean>('alertsLoading',            () => false)

  const fetchAlerts = async () => {
    alertsLoading.value = true
    try {
      const result = await alertService.getAll()
      alerts.value = Array.isArray(result) ? result : []
    } catch (e) {
      console.error('Error loading alerts:', e)
    } finally {
      alertsLoading.value = false
    }
  }

  const fetchDiscussions = async () => {
    discussionsLoading.value = true
    try {
      availableDiscussions.value = (await alertService.getDiscussionList()) || []
    } catch (e) {
      console.error('Failed to load discussions:', e)
    } finally {
      discussionsLoading.value = false
    }
  }

  return {
    alerts,
    availableDiscussions,
    discussionsLoading,
    alertsLoading,
    fetchAlerts,
    fetchDiscussions,
  }
}
