<script setup lang="ts">
import { ref, watch } from "vue";

/*
  Prompt shown when the user picks "Duplicate" from the alert actions
  menu. Compact modal with a single editable title input pre-filled with
  `<original title><localised copy suffix>` (e.g. "My alert-copia" in ES,
  "My alert-copy" in EN, "My alert-copie" in FR).

  Emits `confirm(finalTitle)` — the caller runs the actual POST /api/backend
  and navigates. Cancel just closes.

  Uses <Modal size="compact"> directly (not <ConfirmDialog>) because the
  body is an editable input, not a plain message.
*/

const props = defineProps<{
  open: boolean;
  originalTitle: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", newTitle: string): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

// Local editable title. Reseeded from `originalTitle + suffix` every
// time the dialog reopens so a previous edit doesn't leak into the next
// duplicate attempt.
const draftTitle = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      const base = (props.originalTitle ?? "").trim() || t("common.untitled");
      draftTitle.value = base + t("duplicateModal.copySuffix");
      // Focus the input and select the whole value so a quick rename is
      // one keystroke away.
      requestAnimationFrame(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  },
  { immediate: true },
);

function onConfirm() {
  const clean = draftTitle.value.trim();
  if (!clean) return; // guard: don't create untitled duplicates
  emit("confirm", clean);
}
</script>

<template>
  <Modal :open="open" size="compact" @close="$emit('cancel')">
    <h4>{{ t("duplicateModal.title") }}</h4>
    <p>{{ t("duplicateModal.message") }}</p>

    <div class="field">
      <label class="field-label" for="duplicate-title-input">
        {{ t("duplicateModal.titleLabel") }}
      </label>
      <input
        id="duplicate-title-input"
        ref="inputRef"
        v-model="draftTitle"
        type="text"
        class="field-input"
        :placeholder="t('duplicateModal.titlePlaceholder')"
        @keydown.enter.prevent="onConfirm"
      >
    </div>

    <div class="overlay-actions">
      <div class="dialog-primary-actions">
        <button type="button" class="btn btn-ghost" @click="$emit('cancel')">
          {{ t("button.cancel") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!draftTitle.trim() || !!saving"
          @click="onConfirm"
        >
          {{ saving ? t("common.saving") : t("duplicateModal.confirm") }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* Tone the shared uppercase field-label down for this compact prompt —
 * one short label doesn't need to shout. */
.field-label {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  font-size: var(--text-sm);
}

/* Breathing room between the input and the button row. `.overlay-actions`
 * has no default top margin because most callers precede it with a <p>
 * that already carries `margin-bottom`; a field doesn't. */
.overlay-actions {
  margin-top: var(--space-5);
}

.dialog-primary-actions {
  display: flex;
  gap: var(--space-3);
  margin-left: auto;
}
</style>
