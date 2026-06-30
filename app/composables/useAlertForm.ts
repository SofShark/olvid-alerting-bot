import { ref, computed, watch, type Ref } from "vue";
import { Source, isPolling as isPollingType } from "#shared/types/source";
import { AlertStatus, type AlertModel } from "#shared/types/alert";
import { Formatting, type BundleModel } from "#shared/types/bundle";
import type { DiscussionModel } from "#shared/types/discussion";
import type { PollingParams } from "#shared/types/polling";

/**
 * Owns the AlertModel form shared by AlertView (read) and AlertWizard (write).
 *
 * Deduplicates blankForm / fillFrom / resolveDiscussions which used to live
 * copy-pasted in both monoliths. Also re-resolves discussion titles once the
 * discussion list finishes loading (lazy hydration of `#id` placeholders).
 *
 * The caller passes a Ref<AlertModel | null> — typically `toRef(props, 'alertaInicial')`
 * — and gets back a `form` ref kept in sync with that source.
 */
export const useAlertForm = (source: Ref<AlertModel | null | undefined>) => {
  const { availableDiscussions } = useAlerts();

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

  const resolveDiscussions = (ids: any[]): DiscussionModel[] =>
    (ids ?? []).map((entry: any) => {
      const id = String(typeof entry === "object" ? entry.id : entry);
      const list = availableDiscussions?.value ?? [];
      return list.find((d) => d.id === id) ?? { id, title: `#${id}` };
    });

  const fillFrom = (a: AlertModel | null | undefined) => {
    if (a && a.id) { 
      const incomingParams = (a as any).alertParams;
      const alertParams: PollingParams | undefined =
        a.input === Source.Polling && incomingParams
          ? (incomingParams as PollingParams)
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
          discussion_list: resolveDiscussions(b.discussion_list as any),
        })),
      };
    } else {
      form.value = blankForm();
    }
  };

  watch(source, fillFrom, { immediate: true });

  // Re-resolve discussion titles once the discussion list finishes loading.
  // Inline #N placeholders get replaced by real titles without losing user edits.
  watch(availableDiscussions, (available) => {
    if (available.length === 0) return;
    form.value.bundles = form.value.bundles.map((b) => ({
      ...b,
      discussion_list: resolveDiscussions(b.discussion_list as any),
    }));
  });

  // ── Bundle helpers ────────────────────────────────────────────────────────
  const blankBundle = (): BundleModel => ({
    discussion_list: [],
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
    form.value.bundles.some((b) => b.discussion_list.length === 0),
  );

  // ── Derived shape flags ───────────────────────────────────────────────────
  const isExisting = computed(() => form.value.id !== null);
  const isPolling = computed(() => isPollingType(form.value.input));
  const isWebhook = computed(() => form.value.input === Source.Webhook);

  return {
    form,
    fillFrom,
    resolveDiscussions,
    blankForm,
    blankBundle,
    addBundle,
    updateBundle,
    removeBundle,
    hasEmptyBundle,
    isExisting,
    isPolling,
    isWebhook,
  };
};
