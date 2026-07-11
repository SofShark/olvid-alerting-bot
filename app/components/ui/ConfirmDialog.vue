<script setup lang="ts">
/*
  The canonical "title, message, cancel + confirm" prompt used by every
  destructive / leave-without-saving flow in the app. Wraps <Modal>
  with a default `size="compact"` so it never sprawls.

  Optional `#extra` slot injects a THIRD action at the left of the
  action row (e.g. the wizard's "Save as draft" between navigating away
  and discarding). If the slot is empty, the row collapses to just
  cancel + confirm.

  Emits `confirm` / `cancel` — the host wires the actual side effect.
  Consumers with a third action listen to their own event on whatever
  they put in the slot.

  DiscardChangesDialog was the second implementation of this shape and
  now composes on top of this component — one dialog primitive for the
  whole app.
*/

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "primary" | "danger";
    /** Passed through to <Modal>. Compact by default because prompts
     *  are short-copy widgets; callers with richer bodies can widen. */
    size?: "compact" | "default" | "wide";
  }>(),
  {
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "primary",
    size: "compact",
  },
);

defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <Modal :open="open" :size="size" @close="$emit('cancel')">
    <h4 >{{ title }}</h4>
    <p v-if="message">{{ message }}</p>

    <div class="overlay-actions">
      <!-- Optional third action (e.g. "Save as draft"). Renders on the
           left; the flexbox `space-between` on .overlay-actions keeps
           cancel/confirm right-aligned. If the slot is empty, the
           wrapper stays but produces nothing — flexbox collapses it. -->
      <div class="dialog-extra">
        <slot name="extra" />
      </div>

      <div class="dialog-primary-actions">
        <button type="button" class="btn btn-ghost" @click="$emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="btn"
          :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>

.dialog-extra {
  display: flex;
  gap: var(--space-3);
}
.dialog-primary-actions {
  display: flex;
  gap: var(--space-3);
}
</style>
