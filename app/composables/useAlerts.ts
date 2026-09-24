import type { AlertModel } from "#shared/types/alert";
import type { DiscussionModel } from "#shared/types/discussion";
import { alertService } from "~/utils/alertService";


export const useAlerts = () => {
  const alerts = useState<AlertModel[]>("alerts", () => []);
  const availableDiscussions = useState<DiscussionModel[]>(
    "discussions",
    () => [],
  );
  const discussionsLoading = useState<boolean>(
    "discussionsLoading",
    () => true,
  );
  const alertsLoading = useState<boolean>("alertsLoading", () => false);

  const fetchAlerts = async () => {
    alertsLoading.value = true;
    try {
      const result = await alertService.getAll();
      alerts.value = Array.isArray(result) ? result : [];
    } catch (e) {
      // Any failure (401 after logout, network drop, backend crash) wipes the
      // cached list — otherwise the sidebar would keep showing stale entries
      // that the user is no longer authorized to see.
      alerts.value = [];
      console.error("Error loading alerts:", e);
    } finally {
      alertsLoading.value = false;
    }
  };

  const fetchDiscussions = async () => {
    discussionsLoading.value = true;
    try {
      availableDiscussions.value =
        (await alertService.getDiscussionList()) || [];
    } catch (e) {
      // Same reasoning as fetchAlerts — clear on any failure so the audience
      // picker doesn't offer stale Olvid contacts after a session ends.
      availableDiscussions.value = [];
      console.error("Failed to load discussions:", e);
    } finally {
      discussionsLoading.value = false;
    }
  };

  return {
    alerts,
    availableDiscussions,
    discussionsLoading,
    alertsLoading,
    fetchAlerts,
    fetchDiscussions,
  };
};
