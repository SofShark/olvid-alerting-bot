<template>
  <button class="btn-primary" v-bind="$attrs">
    <slot />
  </button>
</template>

<style scoped>
/* We move your primary button CSS rules right into the component */
.btn-primary {
  background-color: #2563eb;
  color: white;
  border: 1px solid #1d4ed8;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600; 
  font-size: 14px;
  cursor: pointer;
  display: flex; 
  align-items: center; 
  gap: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-primary:hover { 
  background-color: #1d4ed8; 
  border-color: #1e40af; 
}
</style>