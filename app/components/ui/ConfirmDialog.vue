<script setup lang="ts">
/*
  Modal + the canonical "title, message, primary, cancel" shape used by
  almost every destructive / leave-without-saving prompt in the app.

  Slot lets the caller inject extra rows (e.g. the wizard's "Save as draft"
  third button between Cancel and Discard). Emits `confirm` / `cancel` —
  the host wires the actual side effect.
*/
withDefaults(defineProps<{
  open:           boolean
  title:          string
  message?:       string
  confirmLabel?:  string
  cancelLabel?:   string
  variant?:       'primary' | 'danger'
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel:  'Cancel',
  variant:      'primary',
})

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'):  void
}>()
</script>

<template>
  <Modal :open="open" @close="$emit('cancel')">
    <h4>{{ title }}</h4>
    <p v-if="message">{{ message }}</p>
    <slot />
    <div class="overlay-actions">
      <button type="button" class="btn btn-ghost" @click="$emit('cancel')">{{ cancelLabel }}</button>
      <button
        type="button"
        class="btn"
        :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
        @click="$emit('confirm')"
      >{{ confirmLabel }}</button>
    </div>
  </Modal>
</template>
