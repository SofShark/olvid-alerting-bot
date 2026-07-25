<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

// Reads / writes the `data-theme` attribute on <html>. The theme.client.ts
// plugin already applied the persisted theme on boot, so this component only
// needs to flip it and persist the new choice.

const current = ref<"dark" | "light">("dark");

onMounted(() => {
  const attr = document.documentElement.getAttribute("data-theme");
  current.value = attr === "light" ? "light" : "dark";
});

function toggle() {
  const next = current.value === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* private mode */
  }
  current.value = next;
}
const isDark = computed(()=>{
  return current.value==="dark"
})
</script>

<template>
  <ClientOnly>
    <button
      type="button"
      class="nav-toggle"
      :title="$t('topNav.themeToggle')"
      @click="toggle"
    >
      <LucideMoon v-if="isDark" size="14px"/>
      <LucideSun v-else/> 
      
    </button>
  </ClientOnly>
</template>

<style scoped>

</style>
