<script setup lang="ts">
import { AlertStatus } from "#shared/types/alert";

/*
  Context-sensitive wizard footer. Three button shapes depending on which
  step the user is on:

    - On the BUNDLE step (always last): primary Save (uses effectiveFinalStatus
      to label as "Save Alert" or "Save as draft" automatically).
    - On a CONFIG step (general / trigger):
        - If `wouldBeComplete`: primary Save Alert (fast-finish path).
        - Otherwise: secondary "Save as draft" + primary "Continue" / "Add bundles".

  All step-machine state arrives as props; the footer emits semantic intents
  and never touches alertService itself.
*/

defineProps<{
  showBack: boolean;
  saving: boolean;
  isOnBundleStep: boolean;
  isOnLastConfigStep: boolean;
  canAdvance: boolean;
  canSaveDraft: boolean;
  wouldBeComplete: boolean;
  effectiveFinalStatus: AlertStatus;
}>();

defineEmits<{
  (e: "back"): void;
  (e: "next"): void;
  (e: "save"): void;
  (e: "save-draft"): void;
}>();
</script>

<template>
  <div class="panel-foot">
    <button
      v-if="showBack"
      type="button"
      class="btn btn-ghost"
      @click="$emit('back')"
    >
      {{ $t("button.back") }}
    </button>

    <div class="foot-spacer" />

    <!-- Bundle step: final save lives here as the primary CTA. -->
    <template v-if="isOnBundleStep">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        @click="$emit('save')"
      >
        {{
          saving
            ? $t("common.saving")
            : effectiveFinalStatus === AlertStatus.Draft
              ? $t("wizard.footer.saveAsDraft")
              : $t("wizard.footer.saveAlert")
        }}
      </button>
    </template>

    <template v-else>
      <button
        v-if="wouldBeComplete"
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        :title="$t('wizard.footer.saveAlertTitle')"
        @click="$emit('save')"
      >
        {{ saving ? $t("common.saving") : $t("wizard.footer.saveAlert") }}
      </button>
      <button
        v-else
        type="button"
        class="btn btn-secondary"
        :disabled="!canSaveDraft || saving"
        :title="
          canSaveDraft
            ? $t('wizard.footer.saveAsDraftTitle')
            : $t('wizard.footer.saveAsDraftNoTitle')
        "
        @click="$emit('save-draft')"
      >
        {{ saving ? $t("common.saving") : $t("wizard.footer.saveAsDraft") }}
      </button>

      <button
        v-if="isOnLastConfigStep"
        type="button"
        class="btn btn-primary"
        :disabled="!canAdvance || saving"
        @click="$emit('next')"
      >
        {{ $t("button.addBundles") }}
      </button>
      <button
        v-else
        type="button"
        class="btn btn-primary"
        :disabled="!canAdvance || saving"
        @click="$emit('next')"
      >
        {{ $t("button.continue") }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.foot-spacer {
  flex: 1;
}
</style>
