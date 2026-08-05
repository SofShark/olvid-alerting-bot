import { ref, computed, watch, type Ref } from "vue";
import { Source } from "#shared/types/source";
import {
  AlertStatus,
  type AlertModel,
  type AlertParams,
} from "#shared/types/alert";
import {
  Formatting,
  BundleOutputType,
  type BundleModel,
  type BundleOutput,
} from "#shared/types/bundle";

/**
 * Owns the AlertModel form shared by AlertView (read) and AlertWizard (write).
 *
 * The form matches the WIRE shape 1:1 (bundles carry `outputs: BundleOutput[]`,
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
    input: undefined,
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
        (a.input === Source.Polling || a.input === Source.Monitoring) &&
        incomingParams
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
          outputs: (b.outputs ?? []) as BundleOutput[],
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
  const isPolling = computed(() => form.value.input === Source.Polling);
  const isMonitoring = computed(() => form.value.input === Source.Monitoring);
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

// ── Output <-> per-channel helpers ───────────────────────────────────────────
// Bridge between the wire shape (typed outputs) and the flat lists each
// selector component speaks natively (Olvid discussion ids for
// DiscussionSelector, email strings for EmailRecipientSelector).
// The discriminated `BundleOutput` narrows `params` inside each
// filter so no cast is needed at the call site.

export function olvidIdsOf(outputs: BundleOutput[]): string[] {
  return outputs
    .filter((o) => o.type === BundleOutputType.Olvid)
    .map((o) => o.params.discussionId);
}

export function outputsFromOlvidIds(ids: string[]): BundleOutput[] {
  return ids.map((discussionId) => ({
    type: BundleOutputType.Olvid,
    params: { discussionId },
  }));
}

export function mailAddressesOf(outputs: BundleOutput[]): string[] {
  return outputs
    .filter((o) => o.type === BundleOutputType.Mail)
    .map((o) => o.params.address);
}

export function outputsFromMailAddresses(
  addresses: string[],
): BundleOutput[] {
  return addresses.map((address) => ({
    type: BundleOutputType.Mail,
    params: { address },
  }));
}

/** Single place that enforces the "olvid rows first, then mail rows"
 *  ordering on `bundle.outputs`. Any editor that updates one subset
 *  goes through here so the other subset is preserved verbatim.
 *
 *  Note: bundles are now single-kind at the UI layer (see `bundleKind`),
 *  so in practice only one of the two arrays is non-empty per call. The
 *  merge signature is kept so older mixed persistence still round-trips
 *  cleanly through the editor. */
export function mergeOutputs(
  olvidIds: string[],
  mailAddresses: string[],
): BundleOutput[] {
  return [
    ...outputsFromOlvidIds(olvidIds),
    ...outputsFromMailAddresses(mailAddresses),
  ];
}

/** Bundle "kind" is the single output type across a bundle's outputs.
 *  Bundles are now homogeneous by policy (one channel per bundle).
 *  Returns null for empty bundles — the editor prompts the user to
 *  pick one before adding recipients. If a legacy mixed bundle survives
 *  from an older version, we go by the first output's type so the row
 *  keeps rendering (the editor will then normalize on save). */
export function bundleKind(
  outputs: BundleOutput[],
): BundleOutputType | null {
  return outputs[0]?.type ?? null;
}
