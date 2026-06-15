<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Reads / writes the `data-theme` attribute on <html>. The theme.client.ts
// plugin already applied the persisted theme on boot, so this component only
// needs to flip it and persist the new choice.

const current = ref<'dark' | 'light'>('dark')

onMounted(() => {
  const attr = document.documentElement.getAttribute('data-theme')
  current.value = attr === 'light' ? 'light' : 'dark'
})

function toggle() {
  const next = current.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  try { localStorage.setItem('theme', next) } catch { /* private mode */ }
  current.value = next
}
</script>

<template>
  <ClientOnly>
    <button
      type="button"
      class="theme-toggle"
      :title="`Switch to ${current === 'dark' ? 'light' : 'dark'} mode`"
      :aria-label="`Switch to ${current === 'dark' ? 'light' : 'dark'} mode`"
      @click="toggle"
    >
      {{ current === 'dark' ? '☀' : '☾' }}
    </button>
  </ClientOnly>
</template>

<style scoped>
.theme-toggle {
  background: transparent;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-muted);
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  transition: background-color .15s, border-color .15s, color .15s;
}
.theme-toggle:hover {
  background: var(--color-bg-panel);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
