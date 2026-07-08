<script setup lang="ts">
/*
  Shared "would fire?" status strip — a coloured bullet + a one-line
  label, with an optional slot for a details expansion below.

  Consumers today:
    - ConditionEditor    → per-path verdict breakdown in the slot.
    - StatusMatchEditor  → no slot, just the label.

  Two style tokens (ok / ko) so the strip reads at a glance whether the
  current rule is in a firing state or not.
*/

defineProps<{
  ok: boolean;
  label: string;
}>();
</script>

<template>
  <div class="verdict-strip" :class="ok ? 'ok' : 'ko'">
    <span class="verdict-bullet" aria-hidden="true">●</span>
    <span class="verdict-label">{{ label }}</span>
    <div v-if="$slots.detail" class="verdict-detail">
      <slot name="detail" />
    </div>
  </div>
</template>

<style scoped>
.verdict-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  line-height: 1.5;
  border: 1px solid transparent;
}
.verdict-strip.ok {
  background: color-mix(in srgb, var(--color-success, #22c55e) 10%, transparent);
  border-color: color-mix(
    in srgb,
    var(--color-success, #22c55e) 35%,
    transparent
  );
  color: var(--color-text-primary);
}
.verdict-strip.ko {
  background: var(--color-border-subtle);
  border-color: var(--color-border-default);
  color: var(--color-text-muted);
}

.verdict-bullet {
  font-size: var(--text-xs);
  flex-shrink: 0;
}
.verdict-strip.ok .verdict-bullet {
  color: var(--color-success, #22c55e);
}
.verdict-strip.ko .verdict-bullet {
  color: var(--color-text-faint);
}

.verdict-label {
  flex: 1;
  min-width: 0;
}

.verdict-detail {
  flex-basis: 100%;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border-subtle);
  font-size: var(--text-sm);
}
</style>
