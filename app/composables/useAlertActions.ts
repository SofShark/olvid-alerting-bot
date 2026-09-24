import { ref, type Ref } from "vue";
import { AlertStatus, type AlertModel } from "#shared/types/alert";
import { alertService } from "~/utils/alertService";

/**
 * Alert-scoped write actions.
 *
 * Two layers on one object:
 *
 *   ── Primitives (no form binding required) ──
 *     saveAlert    — POST or PUT depending on `isExisting`.
 *     deleteAlert  — DELETE by id.
 *     setStatus    — PATCH status; returns the persisted status.
 *   `saving` exposes an in-flight flag for save calls.
 *
 *   ── Bound flows (need a form ref) ──
 *     openEditAlert    — route to the wizard for the current alert.
 *     duplicateAlert   — clone the current alert under a new title.
 *     toggleStatus     — flip Active ⇄ Inactive on the current alert
 *                        with an optimistic update on the shared alerts
 *                        list so the view doesn't flash.
 *     removeAlert      — delete the current alert and go back to `/`.
 *
 * The bound flows are only wired if the caller passes a `form` ref. That
 * keeps places like the wizard — which only need `saveAlert` — free from
 * the composable's higher-level dependencies (`useAlerts`, navigation).
 */
export const useAlertActions = (form?: Ref<AlertModel>) => {
  const saving = ref(false);

  const saveAlert = async (payload: any, opts: { isExisting: boolean }) => {
    saving.value = true;
    try {
      const res: any = opts.isExisting
        ? await alertService.updateAlert(payload)
        : await alertService.saveAlert(payload);
      return res?.data as AlertModel | undefined;
    } finally {
      saving.value = false;
    }
  };

  const deleteAlert = async (id: number) => {
    return alertService.delete(id);
  };

  const setStatus = async (id: number, status: AlertStatus) => {
    const res: any = await alertService.setStatus(id, status);
    return (res?.data?.status ?? status) as AlertStatus;
  };

  // ── Bound flows ─────────────────────────────────────────────────────────
  // These read the current alert from `form`. Callers that don't bind a
  // form (e.g. the wizard) shouldn't be reaching for them — they throw so
  // the mistake is visible instead of silently a no-op.
  const requireForm = (): Ref<AlertModel> => {
    if (!form) {
      throw new Error(
        "useAlertActions: bound-flow requested without a `form` ref",
      );
    }
    return form;
  };

  /** Runtime-state keys the engine stamps onto alertParams during polling
   *  or monitoring. A duplicated alert must NOT inherit them — the copy
   *  should evaluate from a clean baseline on its first tick. Kept next
   *  to `duplicateAlert` because it's the only caller. */
  const RUNTIME_PARAM_KEYS = new Set([
    "_lastFired",
    "_lastPolledAt",
    "_lastHash",
    "_baseline",
    "_lastStatus",
  ]);
  const cleanAlertParamsForCopy = (params: any): any => {
    if (!params || typeof params !== "object") return params ?? {};
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (!RUNTIME_PARAM_KEYS.has(k)) cleaned[k] = v;
    }
    return cleaned;
  };

  const openEditAlert = () => {
    const f = requireForm();
    if (!f.value.id) return;
    return navigateTo(`/alerts/${f.value.id}?edit=1`);
  };

  const duplicateAlert = async (newTitle: string) => {
    const f = requireForm();
    const trimmed = newTitle.trim();
    if (!trimmed || !f.value.id) return null;

    const { fetchAlerts } = useAlerts();
    const payload = {
      id: null,
      token: null,
      title: trimmed,
      description: f.value.description ?? "",
      input: f.value.input,
      status: AlertStatus.Inactive,
      alertParams: cleanAlertParamsForCopy(f.value.alertParams),
      bundles: f.value.bundles.map((b) => ({
        // No `id` — the DB assigns a fresh one for each cloned bundle.
        name: b.name,
        formating: b.formating,
        custom_script: b.custom_script,
        mailSubject: b.mailSubject,
        outputs: b.outputs,
      })),
    };

    const saved = await saveAlert(payload, { isExisting: false });
    await fetchAlerts();
    if (saved?.id) await navigateTo(`/alerts/${saved.id}`);
    return saved;
  };

  const toggleStatus = async () => {
    const f = requireForm();
    if (!f.value.id) return;
    if ((f.value.bundles?.length ?? 0) === 0) return;

    const next =
      f.value.status === AlertStatus.Active
        ? AlertStatus.Inactive
        : AlertStatus.Active;

    const newStatus = await setStatus(f.value.id, next);
    // Optimistic mutation of both the local form and the shared alerts
    // list so the header doesn't flash. Mutating the alerts entry in
    // place (rather than replacing the row) avoids re-evaluating the
    // page's `alert` computed and cascading through `fillFrom`.
    f.value.status = newStatus;
    const { alerts } = useAlerts();
    const idx = alerts.value.findIndex((a) => a.id === f.value.id);
    if (idx >= 0 && alerts.value[idx]) {
      alerts.value[idx].status = newStatus;
    }
  };

  const removeAlert = async () => {
    const f = requireForm();
    if (!f.value.id) return;
    const { fetchAlerts } = useAlerts();
    await deleteAlert(f.value.id);
    await fetchAlerts();
    await navigateTo("/");
  };

  return {
    saving,
    // primitives
    saveAlert,
    deleteAlert,
    setStatus,
    // bound flows
    openEditAlert,
    duplicateAlert,
    toggleStatus,
    removeAlert,
  };
};
