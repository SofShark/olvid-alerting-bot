<script setup lang="ts">
/*
  Three-way prompt shown when the user tries to navigate away from a
  dirty wizard. The third "Save as draft" button only appears when the
  form has a title (the bare minimum to persist). Each choice emits a
  distinct event so the parent can run its own side effect (save, throw
  away, dismiss).
*/

defineProps<{
  open:          boolean
  canSaveDraft:  boolean
  saving:        boolean
}>()

defineEmits<{
  (e: 'save-draft'):       void
  (e: 'continue-editing'): void
  (e: 'discard'):          void
}>()
</script>

<template>
  <Modal :open="open" :close-on-backdrop="false">
    <h4>{{ $t('wizard.discardModal.title') }}</h4>
    <p>{{ $t('wizard.discardModal.message') }}</p>
    <div class="overlay-actions">
      <button
        v-if="canSaveDraft"
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        @click="$emit('save-draft')"
      >{{ saving ? $t('common.saving') : $t('wizard.footer.saveAsDraft') }}</button>
      <button
        type="button"
        class="btn btn-ghost"
        @click="$emit('continue-editing')"
      >{{ $t('button.continueEditing') }}</button>
      <button
        type="button"
        class="btn btn-danger"
        @click="$emit('discard')"
      >{{ $t('button.discard') }}</button>
    </div>
  </Modal>
</template>
