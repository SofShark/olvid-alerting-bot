<template>
  <div class="placeholder">
    <div class="placeholder-inner">
      <div class="ph-icon">🔔</div>
      <p>Select an alert from the list, or create a new one.</p>
      <ButtonPrimary @click="navigateTo('/alerts/new')">
        <span class="plus-icon">+</span> New Alert
      </ButtonPrimary>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-xl);
}
.placeholder-inner { text-align: center; color: var(--color-text-faint); }
.ph-icon { font-size: 40px; margin-bottom: 12px; }
.placeholder-inner p { margin: 0 0 18px; font-size: 14px; }
.plus-icon { font-size: 16px; line-height: 1; }
</style>
