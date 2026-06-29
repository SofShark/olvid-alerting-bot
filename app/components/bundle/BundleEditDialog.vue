<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { AlertModel } from "#shared/types/alert";
import type { BundleModel } from "#shared/types/bundle";
import type { DiscussionModel } from "#shared/types/discussion";
import type { PollingParams } from "#shared/types/polling";

/*
  Per-bundle edit modal. Owns its own draft + dirty tracking; the parent
  hands in the index and the bundle, and gets back the saved bundle (or
  a `cancel` event).

  Why a separate component: AlertView is pure VIEW mode, but inline-editing
  a single bundle is a write affordance. Keeping the modal here decouples
  the read/write boundary — AlertView only needs to know which index is
  being edited, not the snapshot/dirty/save mechanics.
*/

const props = defineProps<{
  open: boolean;
  bundle: BundleModel | null;
  index: number | null;
  alertContext: AlertModel;
  alertParams?: PollingParams;
  inputSource: string;
  availableDiscussions: DiscussionModel[];
  discussionsLoading: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "save", payload: { index: number; bundle: BundleModel }): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const draft = ref<BundleModel | null>(null);
const snapshot = ref("");
const confirmDiscard = ref(false);

// Snapshot the bundle every time the modal (re)opens.
watch(
  () => [props.open, props.bundle] as const,
  ([open, b]) => {
    if (!open || !b) {
      draft.value = null;
      snapshot.value = "";
      confirmDiscard.value = false;
      return;
    }
    draft.value = { ...b, discussion_list: [...b.discussion_list] };
    snapshot.value = JSON.stringify(draft.value);
    confirmDiscard.value = false;
  },
  { immediate: true },
);

const isDirty = computed(
  () => !!draft.value && JSON.stringify(draft.value) !== snapshot.value,
);

const requestClose = () => {
  if (isDirty.value) {
    confirmDiscard.value = true;
    return;
  }
  emit("cancel");
};

const onSave = () => {
  if (props.index === null || !draft.value) return;
  emit("save", { index: props.index, bundle: draft.value });
};
</script>

<template>
  <Modal :open="open" :close-on-backdrop="false" @close="requestClose">
    <div class="bundle-edit-modal">
      <div class="modal-head">
        <h4>{{ draft?.name || "Untitled bundle" }}</h4>
        <button
          type="button"
          class="modal-close"
          :title="t('editor.bundleModal.closeTitle')"
          @click="requestClose"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <BundleCard
          v-if="draft"
          :bundle="draft"
          :index="index ?? 0"
          :available-discussions="availableDiscussions"
          :discussions-loading="discussionsLoading"
          :input-source="inputSource"
          :alert-context="alertContext"
          :alert-params="alertParams"
          :hide-remove="true"
          @update:bundle="draft = $event"
        />
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
          class="btn btn-secondary"
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
.bundle-edit-modal {
  width: 92vw;
  max-width: 560px;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}
.modal-head h4 {
  margin: 0;
  flex: 1;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
}
.modal-close {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: var(--text-lg);
  cursor: pointer;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}
.modal-close:hover {
  color: var(--color-text-primary);
  background: var(--color-border-subtle);
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-5) var(--space-6);
}
.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
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
