<script setup lang="ts">
import { BundleOutputType } from "#shared/types/bundleOutput";

defineProps<{
  modelValue: BundleOutputType | null;
}>();

defineEmits<{
  (e: "update:modelValue", val: BundleOutputType): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="btn-pill-group"
    role="radiogroup"
    :aria-label="t('bundleKind.groupLabel')"
  >
    <!-- Olvid -->
    <button
      type="button"
      class="btn-pill"
      :class="{ active: modelValue === BundleOutputType.Olvid }"
      @click="$emit('update:modelValue', BundleOutputType.Olvid)"
    >
      <span class="tile-media" aria-hidden="true">
        <OlvidLogo/>
      </span>

      <span class="tile-label">
        {{ t("bundleKind.olvid") }}
      </span>
    </button>

    <!-- Mail -->
    <button
      type="button"
      class="btn-pill"
      :class="{ active: modelValue === BundleOutputType.Mail }"
      @click="$emit('update:modelValue', BundleOutputType.Mail)"
    >
      <span class="tile-media" aria-hidden="true">
        <FontAwesomeIcon :icon="['fas', 'envelope']" />
      </span>

      <span>{{ t("bundleKind.mail") }}</span>
    </button>
  </div>
</template>

<style scoped>

/* ---------- Shared media container ---------- */

.tile-media {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--color-text-faint);
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  .btn-pill.active & {
    color:var(--color-accent)
  }

  .btn-pill:hover:not(.active) &{
    color:var(--color-accent)
  }
}


</style>