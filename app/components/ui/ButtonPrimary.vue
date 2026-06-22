<script setup lang="ts">
  defineProps<{
    small?: boolean
  }>()
</script>

<template>
  <button class="btn-primary" 
          :class="{ 'btn-small': small }"
          v-bind="$attrs">
    <slot />
  </button>
</template>

<style scoped>
.btn-primary {
  background-color: var(--color-accent);
  color: var(--color-text-on-accent);
  border: 1px solid var(--color-accent-hover);
  padding: 8px 16px;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s, border-color 0.15s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-primary.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-accent-hover);
  border-color: var(--color-accent-border);
}

.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
