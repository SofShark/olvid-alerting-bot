<script setup lang="ts">
import type { BundleModel } from '#shared/types/bundle'

/*
  OUTPUT block in view mode: title + count + bundle rows (or the empty hint).
  Hosts the table chrome only; AlertBundleRow owns the per-row render.
*/

defineProps<{
  bundles: BundleModel[]
}>()

defineEmits<{ (e: 'edit-bundle', index: number): void }>()
</script>

<template>
  <div class="data-block">
    <h3 class="data-title">Bundles ({{ bundles.length }})</h3>

    <div v-if="bundles.length === 0" class="bundles-hint">
      <i18n-t keypath="editor.view.noBundles" tag="span">
        <template #editAlert><strong>{{ $t('editor.view.noBundlesEditAlert') }}</strong></template>
      </i18n-t>
    </div>

    <div v-else class="bundles-table">
      <AlertBundleRow
        v-for="(b, i) in bundles"
        :key="b.id ?? i"
        :bundle="b"
        :index="i"
        @edit="$emit('edit-bundle', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.data-block { margin-bottom: var(--space-8); }
.data-block:last-child { margin-bottom: 0; }

.data-title {
  margin: 0;
  padding: 0 0 var(--space-3);
  font-weight: 700;
  color: var(--color-text-primary);
}

.bundles-hint {
  color: var(--color-text-dim);
  font-size: var(--text-md);
  font-style: italic;
  margin: var(--space-3) 0;
}

.bundles-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
