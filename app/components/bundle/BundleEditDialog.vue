<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { isPolling as isPollingSource } from "#shared/types/source";
import type { AlertModel, AlertParams } from "#shared/types/alert";
import {
  Formatting,
  DEFAULT_FORMAT_FOR_POLLING,
  DEFAULT_FORMAT_FOR_WEBHOOK,
  type BundleModel,
} from "#shared/types/bundle";
import type { DiscussionModel } from "#shared/types/discussion";
import { buildPollingDefaultMessage } from "#shared/polling/message";
import {
  olvidIdsOf,
  mailAddressesOf,
  outputsFromOlvidIds,
  outputsFromMailAddresses,
} from "~/composables/useAlertForm";
import {
  BundleOutputType,
  type BundleFrontendOutput,
} from "#shared/types/bundleOutput";

/*
  THE bundle editor — one modal for both flows:

    - Edit    (index: number)  → seeded from the existing bundle.
    - Create  (index: null)    → seeded from a source-appropriate blank;
                                 the parent pushes the result on save.

  Absorbed the former BundleCard: title, WhatsApp-style destination
  picker, format select + custom-script editor + polling preview all
  live here now. Wizard rows and view-mode rows both open this dialog,
  so the two surfaces stay visually and behaviourally identical.

  Owns its own draft + dirty tracking. The parent only receives the
  final bundle on `save` (never a half-edited one) or a `cancel`.
*/

const props = defineProps<{
  open: boolean;
  bundle: BundleModel | null; // null with open=true ⇒ create mode
  index: number | null; //     null              ⇒ create mode
  alertContext: AlertModel;
  alertParams?: AlertParams;
  inputSource: string;
  availableDiscussions: DiscussionModel[];
  discussionsLoading: boolean;
  saving?: boolean;
  /** Live parsed payload from the wizard's trigger step — feeds the
   *  polling-default preview. Optional; preview falls back to a hint. */
  pollPayload?: any;
}>();

const emit = defineEmits<{
  (e: "save", payload: { index: number | null; bundle: BundleModel }): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const isPolling = computed(() => isPollingSource(props.inputSource));

// Source-appropriate empty bundle for create mode.
const blankBundle = (): BundleModel => ({
  outputs: [],
  formating: isPolling.value
    ? DEFAULT_FORMAT_FOR_POLLING
    : DEFAULT_FORMAT_FOR_WEBHOOK,
  custom_script: "",
});

// A stored format can be stale relative to the alert's current source
// (e.g. the user flipped Polling → Webhook after creating the bundle).
// Normalize once at seed time — the source can't change while the modal
// is open, so a watch is unnecessary.
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
// open so the editor's visible state matches what a save would persist —
// no hidden rows to surprise the user later.
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
// Local editor-state for the active channel kind. Kept separate from
// `draft.outputs` so an empty selection still remembers which selector
// to show — deriving kind from `outputs[0]?.type` alone would flip back
// to "no channel picked" the moment the user cleared their picks.
const activeKind = ref<BundleOutputType | null>(null);

// Per-kind recipients stash. Held for the modal's lifetime so flipping
// olvid → mail → olvid restores the discussions the user had before the
// switch. Reset every time the modal opens; discarded on cancel or save.
const outputsByKind = ref<
  Partial<Record<BundleOutputType, BundleFrontendOutput[]>>
>({});

// (Re)seed the draft every time the modal opens. Create mode seeds a
// blank; edit mode deep-copies the incoming bundle.
watch(
  () => [props.open, props.bundle] as const,
  ([open, b]) => {
    if (!open) {
      draft.value = null;
      snapshot.value = "";
      confirmDiscard.value = false;
      outputsByKind.value = {};
      return;
    }
    const seed = b
      ? { ...b, outputs: [...b.outputs] }
      : blankBundle();
    draft.value = normalizeFormat(normalizeToKind(seed));
    activeKind.value = draft.value.outputs[0]?.type ?? null;
    // Seed the stash from whatever kind the bundle opened with. Other
    // kinds start empty and only accumulate as the user picks them.
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

const isCreate = computed(() => props.index === null);
const modalTitle = computed(() =>
  isCreate.value
    ? t("editor.bundleModal.newTitle")
    : t("editor.bundleModal.title", { n: bundleName.value || t("editor.bundleModal.untitled") }),
);

// ── Draft field bindings ──────────────────────────────────────────────────

const patch = (changes: Partial<BundleModel>) => {
  if (!draft.value) return;
  draft.value = { ...draft.value, ...changes };
};

const bundleName = computed<string>({
  get: () => draft.value?.name ?? "",
  set: (val) => patch({ name: val.trim() || undefined }),
});

// `kind` reads from the editor's activeKind, not the outputs array —
// that lets an "I've picked Email but haven't typed an address yet"
// state stick. Once the user commits recipients, activeKind and
// bundleKind(outputs) agree.
const kind = computed<BundleOutputType | null>(() => activeKind.value);

// Switching kind is non-destructive until save: current outputs get
// stashed under the outgoing kind, and if the incoming kind has a
// stashed set we restore it. Fresh kinds start empty. Idempotent when
// the requested kind is already active.
const onKindChange = (next: BundleOutputType) => {
  if (!draft.value || activeKind.value === next) return;
  if (activeKind.value) {
    outputsByKind.value[activeKind.value] = [...draft.value.outputs];
  }
  activeKind.value = next;
  patch({ outputs: outputsByKind.value[next] ?? [] });
};

// Bridge between the outputs shape (source of truth in draft) and the
// DiscussionModel[] API that DiscussionSelector speaks. Title lookup is
// on-the-fly from availableDiscussions; if a discussion hasn't been
// fetched yet, we fall back to `#<id>`.
const discussions = computed<DiscussionModel[]>({
  get: () => {
    if (!draft.value) return [];
    const ids = olvidIdsOf(draft.value.outputs);
    return ids.map((id) => {
      const found = props.availableDiscussions.find((d) => d.id === id);
      return found ?? { id, title: `#${id}` };
    });
  },
  set: (val) => {
    if (!draft.value) return;
    patch({ outputs: outputsFromOlvidIds(val.map((d) => d.id)) });
  },
});

// Mirror of `discussions` for the mail subset. Homogeneous — never
// coexists with olvid rows in the persisted `outputs`.
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

// Format options depend on the alert's source: polling alerts get the
// watched-field-aware formats, everything else the classic trio.
const formatOptions = computed(() =>
  isPolling.value
    ? [
        {
          value: Formatting.PollingDefault,
          label: t("bundleRow.format.pollingDefault"),
        },
        {
          value: Formatting.PollingCustom,
          label: t("bundleRow.format.pollingCustom"),
        },
      ]
    : [
        {
          value: Formatting.Unformatted,
          label: t("bundleRow.format.unformatted"),
        },
        { value: Formatting.Simple, label: t("bundleRow.format.simple") },
        { value: Formatting.Custom, label: t("bundleRow.format.custom") },
      ],
);

const isCustomFormat = computed(
  () =>
    formating.value === Formatting.Custom ||
    formating.value === Formatting.PollingCustom,
);

// ── Custom script editor (nested overlay) ─────────────────────────────────

const isEditorOpen = ref(false);

const onFormatChange = () => {
  if (isCustomFormat.value) isEditorOpen.value = true;
};

const saveScript = (script: string) => {
  patch({ custom_script: script });
  isEditorOpen.value = false;
};

// ── Polling-default preview ───────────────────────────────────────────────

const pollingPreview = computed(() => {
  if (formating.value !== Formatting.PollingDefault) return "";
  if (!props.alertContext) return "";
  return buildPollingDefaultMessage(
    props.alertContext,
    props.pollPayload ?? {},
  );
});

// ── Close / save flow ─────────────────────────────────────────────────────

const requestClose = () => {
  if (isDirty.value) {
    confirmDiscard.value = true;
    return;
  }
  emit("cancel");
};

const onSave = () => {
  if (!draft.value) return;
  emit("save", { index: props.index, bundle: draft.value });
};
</script>

<template>
  <Modal :open="open" size="full" :close-on-backdrop="false" @close="requestClose">
    <div class="bundle-edit-modal">
      <FormatEditor
        v-if="isEditorOpen && draft"
        :initial-script="draft.custom_script || ''"
        :input-source="inputSource"
        :alert-params="alertParams ?? alertContext?.alertParams"
        :alert-id="alertContext?.id ?? null"
        :preview-mode="kind ?? BundleOutputType.Olvid"
        :mail-subject="alertContext?.title"
        @save="saveScript"
        @close="isEditorOpen = false"
      />

      <ModalHead
        :close-label="t('editor.bundleModal.closeTitle')"
        @close="requestClose"
      />

      <div v-if="draft" class="modal-body">
        <!-- Title — optional; rows fall back to "Untitled bundle". -->
        <div class="field">
          <label class="field-label">Title</label>
          <input
            v-model="bundleName"
            type="text"
            class="field-input"
            :placeholder="`Bundle ${(index ?? alertContext.bundles.length) + 1}`"
          >
        </div>

        <!-- Channel picker — one bundle, one kind. -->
        <div class="field">
          <label class="field-label">{{ $t("bundleKind.fieldLabel") }}</label>
          <BundleKindPicker
            :model-value="kind"
            @update:model-value="onKindChange"
          />
        </div>

        <!-- Recipients — the picker above decides which one renders.
             Empty bundles show a soft hint asking the user to pick first. -->
        <div v-if="kind === null" class="field field-hint">
          {{ $t("bundleKind.pickPrompt") }}
        </div>

        <div v-else-if="kind === BundleOutputType.Olvid" class="field">
          <label class="field-label">{{
            $t("bundleRow.fields.discussions")
          }}</label>
          <DiscussionSelector
            v-model="discussions"
            :available="availableDiscussions"
            :is-loading="discussionsLoading"
          />
        </div>

        <div v-else-if="kind === BundleOutputType.Mail" class="field">
          <label class="field-label">{{
            $t("bundleRow.fields.emailRecipients")
          }}</label>
          <EmailRecipientSelector v-model="mailAddresses" />
        </div>

        <!-- Format + optional custom-script editor + preview. -->
        <div class="field">
          <label class="field-label">{{
            $t("bundleRow.fields.format")
          }}</label>
          <div class="format-row">
            <Select
              v-model="formating"
              :options="formatOptions"
              class="format-select"
              @update:model-value="onFormatChange"
            />
            <button
              v-if="isCustomFormat"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="isEditorOpen = true"
            >
              <FontAwesomeIcon :icon="['fas', 'pencil']" />
              {{ $t("bundleRow.scriptButton") }}
            </button>
          </div>

          <pre
            v-if="formating === Formatting.PollingDefault"
            class="poll-preview"
            >{{ pollingPreview || $t("bundleRow.previewPlaceholder") }}</pre
          >
        </div>
      </div>

      <div v-if="confirmDiscard" class="modal-foot discard-foot">
        <span class="discard-msg">{{
          t("editor.bundleModal.discardWarning")
        }}</span>
        <button
          type="button"
          class="btn btn-ghost"
          @click="confirmDiscard = false"
        >
          {{ t("editor.bundleModal.keepEditingButton") }}
        </button>
        <button type="button" class="btn btn-danger" @click="emit('cancel')">
          {{ t("editor.bundleModal.discardButton") }}
        </button>
      </div>
      <div v-else class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="requestClose">
          {{ t("editor.bundleModal.cancelButton") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          @click="onSave"
        >
          {{
            saving
              ? t("editor.bundleModal.savingButton")
              : t("editor.bundleModal.saveButton")
          }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* Sizing (92vw × 80vh, capped at 700px) is provided by
 * <Modal size="full"> — see overlay-box--full in overlay.css. This
 * wrapper only owns the flex layout of head/body/foot. */
.bundle-edit-modal {
  width: 100%;
  height: 100%;
  display: flex;
  padding: 0 var(--space-4);
  flex-direction: column;
}
.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.field-hint {
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-input);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-base);
  font-style: italic;
  text-align: center;
}

.format-row {
  display: flex;
  gap: var(--space-3);
}
.format-select {
  flex: 1;
}

.poll-preview {
  margin: var(--space-3) 0 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-input);
  border: 1px dashed var(--color-accent-border);
  border-radius: var(--radius-md);
  color: var(--color-accent-text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
}

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
}
.modal-foot.discard-foot {
  background: var(--color-warning-soft);
}
.discard-msg {
  flex: 1;
  color: var(--color-warning-text);
  font-size: var(--text-md);
  font-weight: 600;
}
</style>
