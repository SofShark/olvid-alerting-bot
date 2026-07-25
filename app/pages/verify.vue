<script setup lang="ts">
const route = useRoute();
const status = ref<"pending" | "success" | "error">("pending");

const token = computed(() => {
  const t = route.query.token;
  return typeof t === "string" ? t : "";
});

onMounted(async () => {
  if (!token.value) {
    status.value = "error";
    return;
  }
  try {
    await $fetch("/api/auth/verify-email", {
      method: "POST",
      body: { token: token.value },
    });
    status.value = "success";
  } catch {
    status.value = "error";
  }
});
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <template v-if="status === 'pending'">
        <h4>Verifying…</h4>
      </template>
      <template v-else-if="status === 'success'">
        <h4>Email verified</h4>
        <p class="hint">Your email address is confirmed. You can sign in now.</p>
        <NuxtLink to="/login" class="btn btn-primary">Go to login</NuxtLink>
      </template>
      <template v-else>
        <h4>Verification failed</h4>
        <p class="hint">
          This link is invalid, expired, or already used. Request a new one
          from the login page.
        </p>
        <NuxtLink to="/login" class="btn btn-primary">Back to login</NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
  margin-bottom: var(--space-4);
}
</style>
