// Editor-side logic for the BundleEditDialog modal — everything that
// isn't template markup or CSS. The dialog was ~290 LOC of script mixing
// draft lifecycle, format normalization, per-kind recipient stash, and
// v-model getters/setters; extracting them here leaves the .vue file as
// a thin wiring layer over reactive state exposed by this composable.
//
// Design:
//   · Draft lives here — a deep-copied editable clone of the incoming
//     bundle, or a source-appropriate blank in create mode. Reseeds
//     every time `open` flips true (watch fires on the tuple).
//   · Dirty tracking is JSON-snapshot-based (cheap, no per-field
//     comparators — the modal isn't large enough to warrant them).
//   · Per-kind outputs stash: flipping olvid → mail → olvid restores
//     the discussion picks. Reset every open, discarded on close.
//   · No fetch calls. The parent owns `availableDiscussions` and the
//     save round-trip; this composable is pure client-side state.

import { ref, computed, watch, type Ref } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import {
  Formatting,
  DEFAULT_FORMAT_FOR_POLLING,
  DEFAULT_FORMAT_FOR_WEBHOOK,
  BundleOutputType,
  type BundleModel,
  type BundleOutput,
} from "#shared/types/bundle";
import type { DiscussionModel, DiscussionKind } from "#shared/types/discussion";
import {
  olvidIdsOf,
  mailAddressesOf,
  outputsFromOlvidIds,
  outputsFromMailAddresses,
} from "~/composables/useAlertForm";

export interface BundleEditorInputs {
  open: Ref<boolean>;
  bundle: Ref<BundleModel | null>;
  alertContext: Ref<AlertModel>;
  inputSource: Ref<string | undefined>;
  availableDiscussions: Ref<DiscussionModel[]>;
}

export const useBundleEditor = (inputs: BundleEditorInputs) => {
  const isPolling = computed(
    () => inputs.inputSource.value === Source.Polling,
  );

  // Source-appropriate empty bundle for create mode.
  const blankBundle = (): BundleModel => ({
    outputs: [],
    formating: isPolling.value
      ? DEFAULT_FORMAT_FOR_POLLING
      : DEFAULT_FORMAT_FOR_WEBHOOK,
    custom_script: "",
  });

  // A stored format can be stale relative to the alert's current source
  // (e.g. Polling → Webhook after creating the bundle). Normalize once at
  // seed time — source can't change while the modal is open.
  const normalizeFormat = (b: BundleModel): BundleModel => {
    const isPollingFmt =
      b.formating === Formatting.PollingDefault ||
      b.formating === Formatting.PollingCustom;
    if (isPolling.value && !isPollingFmt) {
      return { ...b, formating: DEFAULT_FORMAT_FOR_POLLING };
    }
    if (!isPolling.value && isPollingFmt) {
      return { ...b, formating: DEFAULT_FORMAT_FOR_WEBHOOK };
    }
    return b;
  };

  // Legacy bundles may persist mixed-kind `outputs` (from before the
  // one-channel-per-bundle policy). Collapse to the first row's kind on
  // open so the editor's visible state matches a save.
  const normalizeToKind = (b: BundleModel): BundleModel => {
    const firstKind = b.outputs[0]?.type;
    if (!firstKind) return b;
    const filtered = b.outputs.filter((o) => o.type === firstKind);
    return filtered.length === b.outputs.length
      ? b
      : { ...b, outputs: filtered };
  };

  const draft = ref<BundleModel | null>(null);
  const snapshot = ref("");
  const confirmDiscard = ref(false);
  const activeKind = ref<BundleOutputType | null>(null);
  const outputsByKind = ref<
    Partial<Record<BundleOutputType, BundleOutput[]>>
  >({});
  const isEditorOpen = ref(false);

  // (Re)seed the draft every time the modal opens.
  watch(
    () => [inputs.open.value, inputs.bundle.value] as const,
    ([open, b]) => {
      if (!open) {
        draft.value = null;
        snapshot.value = "";
        confirmDiscard.value = false;
        outputsByKind.value = {};
        return;
      }
      const seed = b ? { ...b, outputs: [...b.outputs] } : blankBundle();
      draft.value = normalizeFormat(normalizeToKind(seed));
      activeKind.value = draft.value.outputs[0]?.type ?? null;
      outputsByKind.value = activeKind.value
        ? { [activeKind.value]: [...draft.value.outputs] }
        : {};
      snapshot.value = JSON.stringify(draft.value);
      confirmDiscard.value = false;
    },
    { immediate: true },
  );

  const isDirty = computed(
    () => !!draft.value && JSON.stringify(draft.value) !== snapshot.value,
  );

  const patch = (changes: Partial<BundleModel>) => {
    if (!draft.value) return;
    draft.value = { ...draft.value, ...changes };
  };

  const bundleName = computed<string>({
    get: () => draft.value?.name ?? "",
    set: (val) => patch({ name: val.trim() ? val : undefined }),
  });

  // Kind reads from `activeKind`, not from outputs[0].type — so a
  // "picked Email, haven't typed an address yet" state sticks.
  const kind = computed<BundleOutputType | null>(() => activeKind.value);

  // Switching kind is non-destructive until save: stash the current
  // outputs under the outgoing kind, restore any stashed set for the
  // incoming one.
  const onKindChange = (next: BundleOutputType) => {
    if (!draft.value || activeKind.value === next) return;
    if (activeKind.value) {
      outputsByKind.value[activeKind.value] = [...draft.value.outputs];
    }
    activeKind.value = next;
    patch({ outputs: outputsByKind.value[next] ?? [] });
  };

  // Bridge between outputs (source of truth) and the DiscussionModel[]
  // v-model that DiscussionSelector speaks. Titles look up on-the-fly
  // against availableDiscussions; unresolved ids fall back to `#<id>`.
  const discussions = computed<DiscussionModel[]>({
    get: () => {
      if (!draft.value) return [];
      const ids = olvidIdsOf(draft.value.outputs);
      return ids.map((id) => {
        const found = inputs.availableDiscussions.value.find(
          (d) => d.id === id,
        );
        return (
          found ?? {
            id,
            title: `#${id}`,
            kind: "contact" as DiscussionKind,
            photoDataUrl: null,
          }
        );
      });
    },
    set: (val) => {
      if (!draft.value) return;
      patch({ outputs: outputsFromOlvidIds(val.map((d) => d.id)) });
    },
  });

  // Mirror of `discussions` for the mail channel. Homogeneous — never
  // coexists with olvid rows in persisted `outputs`.
  const mailAddresses = computed<string[]>({
    get: () => (draft.value ? mailAddressesOf(draft.value.outputs) : []),
    set: (val) => {
      if (!draft.value) return;
      patch({ outputs: outputsFromMailAddresses(val) });
    },
  });

  const formating = computed<Formatting>({
    get: () => draft.value?.formating ?? Formatting.Unformatted,
    set: (val) => patch({ formating: val }),
  });

  const isCustomFormat = computed(
    () =>
      formating.value === Formatting.Custom ||
      formating.value === Formatting.PollingCustom,
  );

  // Format select auto-opens the script editor when the user commits to
  // one of the custom variants.
  const onFormatChange = () => {
    if (isCustomFormat.value) isEditorOpen.value = true;
  };

  const saveScript = (script: string) => {
    patch({ custom_script: script });
    isEditorOpen.value = false;
  };

  return {
    // state
    draft,
    isDirty,
    confirmDiscard,
    activeKind,
    isEditorOpen,
    // computed
    isPolling,
    kind,
    isCustomFormat,
    // bindings
    bundleName,
    discussions,
    mailAddresses,
    formating,
    // handlers
    onKindChange,
    onFormatChange,
    saveScript,
    patch,
  };
};
