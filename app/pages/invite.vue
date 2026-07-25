<script setup lang="ts">
import type { AcceptInviteForm } from "#shared/types/auth";

const route = useRoute();
const { fetch: refreshSession } = useUserSession();

const token = computed(() => {
  const t = route.query.token;
  return typeof t === "string" ? t : "";
});

const form = reactive<AcceptInviteForm>({
  token: "",
  password: "",
  name: "",
  
});
watchEffect(() => (form.token = token.value));

const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  if (!form.token) {
    error.value = "Missing invitation token.";
    return;
  }
  try {
    await $fetch("/api/auth/accept-invite", {
      method: "POST",
      body: {
        token: form.token,
        password: form.password,
        name: form.name || undefined,
      },
    });
    await refreshSession();
    await navigateTo("/");
  } catch {
    error.value = "This invitation is invalid, expired, or already used.";
  }
}
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <h4>Accept invitation</h4>
      <p class="hint">{{`Set a password to activate your account.`}}</p> 
      <form class="invite-form" @submit.prevent="submit">
        <input
          v-model="form.name"
          class="field-input"
          type="text"
          placeholder="Name (optional)"
          required
        />
        <input
          v-model="form.password"
          class="field-input"
          type="password"
          placeholder="Password (min 8 chars)"
          minlength="8"
          required
        />
        <button type="submit" class="btn btn-primary">Activate account</button>
      </form>
      <p v-if="error" class="msg msg--error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
}
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger-strong);
}
</style>
