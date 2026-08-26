<script setup lang="ts">
import { computed } from "vue";

/*
  Condition row inside AlertInputSummary. Takes a raw condition (possibly
  the compact `kind: None` shape) and renders the localised headline plus
  the watched-path chips.

  Pure: relies entirely on `useConditionSummary` to migrate + label the
  condition, so the wording lives in one place (the composable) and any
  other view that needs the same summary picks up the same labels.
*/

const props = defineProps<{
  condition: any;
}>();

const { conditionSummary } = useConditionSummary();
const summary = computed(() => conditionSummary(props.condition));
</script>

<template>
  <div>
    <p class="condition-text">{{ summary.headline }}</p>
    <div v-if="summary.paths.length > 0" class="path-list">
      <div class="chip" :title="summary.paths[0]">
        <span class="chip-path">{{ summary.paths[0] }}</span>
      </div>
      <div v-if="summary.paths.length > 1" class="chip">
        <span class="chip-path">+{{ summary.paths.length - 1 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.condition-text {
  margin: 0 0 var(--space-2);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  line-height: 1.5;
}
.path-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--color-text-dim);
}

</style>
