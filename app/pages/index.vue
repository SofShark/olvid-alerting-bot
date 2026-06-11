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
  background: #0b1120;
  border: 1px dashed #1e293b;
  border-radius: 8px;
}
.placeholder-inner { text-align: center; color: #475569; }
.ph-icon { font-size: 40px; margin-bottom: 12px; }
.placeholder-inner p { margin: 0 0 18px; font-size: 14px; }
.plus-icon { font-size: 16px; line-height: 1; }
</style>
