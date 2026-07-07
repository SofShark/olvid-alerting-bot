<script setup lang="ts">
/*
  Wizard masthead: editable title + description inputs and a Back button.
  The visual contract matches AlertViewHeader (same typography, same
  position) — only the interaction differs (inputs vs. read-only text).
*/

defineProps<{
  title: string;
  description: string;
}>();

defineEmits<{
  (e: "update:title", v: string): void;
  (e: "update:description", v: string): void;
  (e: "back"): void;
}>();
</script>

<template>
  <div class="panel-head">
    <div class="head-left">
      <div class="head-title-block">
        <div class="title-row">
          <input
            :value="title"
            type="text"
            :placeholder="$t('common.untitledAlert')"
            class="title-input"
            :aria-label="$t('wizard.alertTitleAria')"
            @input="
              $emit('update:title', ($event.target as HTMLInputElement).value)
            "
          >
        </div>
        <input
          :value="description"
          type="text"
          :placeholder="$t('common.descriptionPlaceholder')"
          class="description-input"
          :aria-label="$t('wizard.alertDescriptionAria')"
          @input="
            $emit(
              'update:description',
              ($event.target as HTMLInputElement).value,
            )
          "
        >
      </div>
    </div>
    <button type="button" class="btn btn-ghost" @click="$emit('back')">
      🡐 {{ $t("button.backToList") }}
    </button>
  </div>
</template>

<style scoped>
.head-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}
.head-title-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.title-input {
  flex: 1;
  min-width: 0;
  margin: 0;
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px dashed transparent;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: 1.2;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  transition:
    background-color 0.15s ease,
    border-bottom-color 0.15s ease;
}
.title-input::placeholder {
  color: var(--color-text-faint);
  font-weight: 600;
}
.title-input:hover:not(:focus) {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-border-default);
}
.title-input:focus {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-accent);
  border-bottom-style: solid;
}

.description-input {
  margin: 0;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px dashed transparent;
  color: var(--color-text-muted);
  font-size: var(--text-base);
  font-weight: 400;
  line-height: 1.4;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-family: inherit;
  transition:
    background-color 0.15s ease,
    border-bottom-color 0.15s ease,
    color 0.15s ease;
}
.description-input::placeholder {
  color: var(--color-text-faint);
  font-style: italic;
}
.description-input:hover:not(:focus) {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-border-subtle);
  color: var(--color-text-secondary);
}
.description-input:focus {
  background: var(--color-bg-card-soft);
  border-bottom-color: var(--color-accent);
  border-bottom-style: solid;
  color: var(--color-text-primary);
}
</style>
