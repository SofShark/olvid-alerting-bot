<script setup lang="ts">
import { BundleOutputType } from "#shared/types/bundleOutput";
//import olvidSmall from "~/assets/olvid_small.png";
//import olvidSmallInverted from "~/assets/olvid_small_inverted.png";
import olvidSmall from "~/assets/olvid-small-no-bg.svg";

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
    class="kind-picker"
    role="radiogroup"
    :aria-label="t('bundleKind.groupLabel')"
  >
    <!-- Olvid -->
    <button
      type="button"
      class="tile"
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
      class="tile"
      :class="{ active: modelValue === BundleOutputType.Mail }"
      @click="$emit('update:modelValue', BundleOutputType.Mail)"
    >
      <span class="tile-media" aria-hidden="true">
        <FontAwesomeIcon :icon="['fas', 'envelope']" />
      </span>

      <span class="tile-label">
        {{ t("bundleKind.mail") }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.kind-picker {
  display: inline-flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tile {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  color: var(--color-text-muted);
  font: inherit;
  cursor: pointer;
  transition:
    border-color .15s,
    background-color .15s,
    color .15s;
}

.tile:hover:not(.active) {
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

.tile:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.tile.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-text-primary);
}

/* ---------- Shared media container ---------- */

.tile-media {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--color-text-faint);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  .tile.active & {
    color:var(--color-accent)
  }
  .tile:hover:not(.active) &{
    color:var(--color-accent)
  }
}


/* ---------- Label ---------- */

.tile-label {
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: .01em;
}
</style>