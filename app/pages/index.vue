<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});
</script>

<template>
  <div class="placeholder">
    <div class="placeholder-inner">
      <div class="ph-icon">
        <LucideBell :stroke-width="1.5" fill="var(--color-accent-border)"/>
      
      </div>
      <p>{{ $t("index.placeholder") }}</p>
      <button
        type="button"
        class="btn btn-primary"
        @click="navigateTo('/alerts/new')"
      >
        <span class="plus-icon">+</span> {{ $t("button.newAlert") }}
      </button>

     
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-panel);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-xl);
}
.placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;

  color: var(--color-text-faint);
}
.ph-icon {
  color: var(--color-accent);
  fill: var(--color-accent);
  font-size: 50px;
  margin-bottom: 12px;
}
.placeholder-inner p {
  margin: 0 0 18px;
  font-size: 14px;
}
.plus-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
