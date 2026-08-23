<script setup lang="ts">
import type { ConditionOutcome } from "#shared/types/testResult";

/*
  Top-line answer of a test run: FIRED / DID NOT FIRE badge + headline
  sentence + optional reason line. Left-border tint carries the state
  colour so the card still reads without the badge.

  Owns nothing but presentation — the copy comes from the caller so
  the same card can back other "would this fire?" surfaces later.
*/

defineProps<{
  outcome: ConditionOutcome;
  /** Sentence to the right of the badge. Caller-supplied to keep this
   *  component free of source-specific phrasing. */
  headline: string;
}>();
</script>

<template>
  <div class="verdict-card" :class="outcome.fired ? 'fired' : 'not-fired'">
    <div class="verdict-row">
      <span class="verdict-badge">
        <span class="verdict-dot" aria-hidden="true" />
        <span v-if="outcome.fired">{{ $t("testVerdict.fired") }}</span>
        <span v-else>{{ $t("testVerdict.notFired") }}</span>
      </span>
      <span class="verdict-headline">{{ headline }}</span>
    </div>
    <p v-if="outcome.reason" class="verdict-reason">{{ outcome.reason }}</p>
  </div>
</template>

<style scoped>
.verdict-card {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-bg-card-soft);
  border: 1px solid var(--color-border-subtle);
  border-left-width: 4px;
}
.verdict-card.fired {
  border-left-color: var(--color-success);
  background: var(--color-success-soft);
}
.verdict-card.not-fired {
  border-left-color: var(--color-text-dim);
}

.verdict-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.verdict-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 4px var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  flex-shrink: 0;
}
.verdict-card.fired .verdict-badge {
  color: var(--color-success);
}
.verdict-card.not-fired .verdict-badge {
  color: var(--color-text-dim);
}

.verdict-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.verdict-headline {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
}

.verdict-reason {
  margin: var(--space-3) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}
</style>
