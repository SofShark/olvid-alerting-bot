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
    await authService.verifyEmail(token.value);
    status.value = "success";
  } catch {
    status.value = "error";
  }
});
</script>

<template>
  <AuthCard>
    <template v-if="status === 'pending'">
      <h4>{{ $t("auth.verify.pending") }}</h4>
    </template>
    <template v-else-if="status === 'success'">
      <h4>{{ $t("auth.verify.successTitle") }}</h4>
      <p class="hint">{{ $t("auth.verify.successBody") }}</p>
      <NuxtLink to="/login" class="btn btn-primary">
        {{ $t("auth.verify.successCta") }}
      </NuxtLink>
    </template>
    <template v-else>
      <h4>{{ $t("auth.verify.errorTitle") }}</h4>
      <p class="hint">{{ $t("auth.verify.errorBody") }}</p>
      <NuxtLink to="/login" class="btn btn-primary">
        {{ $t("auth.verify.errorCta") }}
      </NuxtLink>
    </template>
  </AuthCard>
</template>

<style scoped>
.hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
  margin-bottom: var(--space-4);
}
</style>
