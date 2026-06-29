<script setup lang="ts">
import { computed } from "vue";
import { Formatting, type BundleModel } from "#shared/types/bundle";
import type { AlertModel } from "#shared/types/alert";

/*
  Step 3 (always last): per-alert bundles grid.

  Owns the add / update / remove operations on `form.bundles` directly;
  the wizard doesn't need to thread three event handlers down. The empty-
  bundle warning ("save will be downgraded to draft") only renders when
  at least one bundle exists and any of them has no destinations.
*/

const form = defineModel<AlertModel>({ required: true });

const props = defineProps<{
  availableDiscussions: any[];
  discussionsLoading: boolean;
  pollPayload: any;
}>();

const blankBundle = (): BundleModel => ({
  discussion_list: [],
  formating: Formatting.Unformatted,
  custom_script: "",
});

const addBundle = () => {
  form.value.bundles.push(blankBundle());
};
const updateBundle = (i: number, b: BundleModel) => {
  form.value.bundles[i] = b;
};
const removeBundle = (i: number) => {
  form.value.bundles.splice(i, 1);
};

const hasEmptyBundle = computed(() =>
  form.value.bundles.some((b) => b.discussion_list.length === 0),
);
</script>

<template>
  <div>
    <p class="step-intro">
      <i18n-t keypath="wizard.bundleStep.intro" tag="span">
        <template #bundle
          ><strong>{{ $t("wizard.bundleStep.bundleWord") }}</strong></template
        >
      </i18n-t>
    </p>

    <div class="bundles-grid">
      <BundleCard
        v-for="(b, i) in form.bundles"
        :key="i"
        :bundle="b"
        :index="i"
        :available-discussions="availableDiscussions"
        :discussions-loading="discussionsLoading"
        :input-source="form.input"
        :alert-context="form"
        :poll-payload="pollPayload"
        :alert-params="form.alertParams"
        @update:bundle="updateBundle(i, $event)"
        @remove="removeBundle(i)"
      />

      <button type="button" class="card-add" @click="addBundle">
        <span class="plus">+</span>
        <span>{{
          form.bundles.length === 0
            ? $t("wizard.bundleStep.startAdding")
            : $t("wizard.bundleStep.newBundle")
        }}</span>
      </button>
    </div>

    <p v-if="form.bundles.length > 0 && hasEmptyBundle" class="warn-hint">
      <i18n-t keypath="wizard.bundleStep.warnHint" tag="span">
        <template #draft
          ><strong>{{ $t("wizard.bundleStep.draftWord") }}</strong></template
        >
      </i18n-t>
    </p>
  </div>
</template>

<style scoped>
.step-intro {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-base);
  line-height: 1.5;
}
.step-intro strong {
  color: var(--color-text-secondary);
}

.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
}

.warn-hint {
  margin: 0;
  padding: var(--space-3) var(--space-5);
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-lg);
  color: var(--color-warning-text);
  font-size: var(--text-md);
  line-height: 1.5;
}
.warn-hint strong {
  color: var(--color-warning-bright);
}
</style>
