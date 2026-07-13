<script setup lang="ts">
import { ref, watch } from "vue";

/*
  Source-agnostic explainer shown before the first "Test now" of a
  session. Reads a bare localStorage flag ("don't show again"); the
  parent (AlertView) owns the flag itself and calls this dialog only
  when the user hasn't opted out.

  Says nothing about polling vs monitoring specifically — the copy
  covers the invariant guarantees (no activation, no persistence, no
  bundle notifications). Future sources should keep that invariant so
  the copy stays valid.
*/

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", dontShowAgain: boolean): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const dontShowAgain = ref(false);

// Reset the checkbox each time the dialog reopens so a previous session's
// tick doesn't leak into the current one.
watch(
  () => props.open,
  (opened) => {
    if (opened) dontShowAgain.value = false;
  },
);
</script>

<template>
  <Modal
    :open="open"
    size="default"
    :aria-label="t('testIntroDialog.title')"
    @close="emit('cancel')"
  >
    <h4>{{ t("testIntroDialog.title") }}</h4>
    <p>{{ t("testIntroDialog.body") }}</p>

    <label class="dont-show-again">
      <input v-model="dontShowAgain" type="checkbox">
      <span>{{ t("testIntroDialog.dontShowAgain") }}</span>
    </label>

    <div class="overlay-actions">
      <div class="dialog-primary-actions">
        <button type="button" class="btn btn-ghost" @click="emit('cancel')">
          {{ t("button.cancel") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="emit('confirm', dontShowAgain)"
        >
          {{ t("testIntroDialog.confirm") }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.dont-show-again {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-3) 0 var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  user-select: none;
}
.dont-show-again input {
  cursor: pointer;
}

.overlay-actions {
  margin-top: var(--space-4);
}
.dialog-primary-actions {
  display: flex;
  gap: var(--space-3);
  margin-left: auto;
}
</style>
