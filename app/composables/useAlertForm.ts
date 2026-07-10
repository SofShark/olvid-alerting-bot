import { ref, computed, watch, type Ref } from "vue";
import {
  Source,
  isPolling as isPollingType,
  isMonitoring as isMonitoringType,
  isScheduled,
} from "#shared/types/source";
import {
  AlertStatus,
  type AlertModel,
  type AlertParams,
} from "#shared/types/alert";
import { Formatting, type BundleModel } from "#shared/types/bundle";
import {
  BundleOutputType,
  type BundleFrontendOutput,
} from "#shared/types/bundleOutput";

/**
 * Owns the AlertModel form shared by AlertView (read) and AlertWizard (write).
 *
 * The form matches the WIRE shape 1:1 (bundles carry `outputs: BundleFrontendOutput[]`,
 * not pre-resolved discussion titles). Components that need a title
 * (AlertBundleRow, DiscussionSelector, …) look it up on the fly against
 * `useAlerts().availableDiscussions`. This keeps the form dumb and the
 * enrichment lazy, so re-fetches / late-arriving discussion lists don't
 * require re-resolving stored copies.
 */
export const useAlertForm = (source: Ref<AlertModel | null | undefined>) => {
  const blankForm = (): AlertModel => ({
    id: null,
    title: "",
    description: "",
    input: "",
    status: AlertStatus.Draft,
    token: "",
    // alertParams omitted — undefined for a fresh form. Populated by the
    // source-binding setter once the user picks Polling.
    bundles: [],
  });

  const form = ref<AlertModel>(blankForm());

  const fillFrom = (a: AlertModel | null | undefined) => {
    if (a && a.id) {
      const incomingParams = (a as any).alertParams;
      // Any scheduled source (Polling OR Monitoring) carries params; the
      // union member is discriminated by `input` downstream. Webhook
      // alerts carry none.
      const alertParams: AlertParams =
        isScheduled(a.input) && incomingParams
          ? (incomingParams as AlertParams)
          : undefined;

      form.value = {
        id: a.id,
        title: a.title || "",
        description: a.description || "",
        input: a.input,
        status: a.status || AlertStatus.Draft,
        token: a.token || "",
        alertParams,
        bundles: (a.bundles ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          formating: (b.formating as Formatting) || Formatting.Unformatted,
          custom_script: b.custom_script || "",
          outputs: (b.outputs ?? []) as BundleFrontendOutput[],
        })),
      };
    } else {
      form.value = blankForm();
    }
  };

  watch(source, fillFrom, { immediate: true });

  // ── Bundle helpers ────────────────────────────────────────────────────────
  const blankBundle = (): BundleModel => ({
    outputs: [],
    formating: Formatting.Unformatted,
    custom_script: "",
  });

  const addBundle = () => {
    form.value.bundles.push(blankBundle());
  };
  const updateBundle = (index: number, b: BundleModel) => {
    form.value.bundles[index] = b;
  };
  const removeBundle = (index: number) => {
    form.value.bundles.splice(index, 1);
  };

  const hasEmptyBundle = computed(() =>
    form.value.bundles.some((b) => b.outputs.length === 0),
  );

  // ── Derived shape flags ───────────────────────────────────────────────────
  const isExisting = computed(() => form.value.id !== null);
  const isPolling = computed(() => isPollingType(form.value.input));
  const isMonitoring = computed(() => isMonitoringType(form.value.input));
  const isWebhook = computed(() => form.value.input === Source.Webhook);

  return {
    form,
    fillFrom,
    blankForm,
    blankBundle,
    addBundle,
    updateBundle,
    removeBundle,
    hasEmptyBundle,
    isExisting,
    isPolling,
    isMonitoring,
    isWebhook,
  };
};

// ── Output <-> Olvid-id helpers ──────────────────────────────────────────────
// Bridge between the wire shape (typed outputs) and the flat string[] of
// discussion ids that DiscussionSelector still speaks natively.

export function olvidIdsOf(outputs: BundleFrontendOutput[]): string[] {
  return outputs
    .filter((o) => o.type === BundleOutputType.Olvid)
    .map((o) => o.params.discussionId);
}

export function outputsFromOlvidIds(ids: string[]): BundleFrontendOutput[] {
  return ids.map((discussionId) => ({
    type: BundleOutputType.Olvid,
    params: { discussionId },
  }));
}
