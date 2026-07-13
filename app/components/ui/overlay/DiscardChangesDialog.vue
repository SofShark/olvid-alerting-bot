<script setup lang="ts">
/*
  Wizard's "you have unsaved changes" prompt. Thin wrapper over
  ConfirmDialog:
    · cancel   →  "Continue editing"  (dismiss)
    · confirm  →  "Discard"           (throw away the work, danger)
    · #extra   →  "Save as draft"     (only when the form is savable)

  All the modal / layout logic lives in ConfirmDialog + Modal now —
  this file only provides the wizard-specific labels, event names, and
  the save-draft button's disabled-while-saving affordance.
*/

defineProps<{
  open: boolean;
  canSaveDraft: boolean;
  saving: boolean;
}>();

defineEmits<{
  (e: "save-draft"): void;
  (e: "continue-editing"): void;
  (e: "discard"): void;
}>();
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="$t('wizard.discardModal.title')"
    :message="$t('wizard.discardModal.message')"
    :confirm-label="$t('button.discard')"
    :cancel-label="$t('button.continueEditing')"
    variant="danger"
    @confirm="$emit('discard')"
    @cancel="$emit('continue-editing')"
  >
    <template v-if="canSaveDraft" #extra>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        @click="$emit('save-draft')"
      >
        {{ saving ? $t("common.saving") : $t("wizard.footer.saveAsDraft") }}
      </button>
    </template>
  </ConfirmDialog>
</template>
