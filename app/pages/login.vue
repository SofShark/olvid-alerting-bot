<script setup lang="ts">
import type { CredentialsForm } from "#shared/types/auth";

const { fetch: refreshSession } = useUserSession();
const credentials = reactive<CredentialsForm>({ email: "", password: "" });
const error = ref<string | null>(null);
const needsVerification = ref(false);
const resent = ref(false);

async function login() {
  error.value = null;
  needsVerification.value = false;
  resent.value = false;
  try {
    await $fetch("/api/auth/login", { method: "POST", body: credentials });
    await refreshSession();
    await navigateTo("/");
  } catch (err: unknown) {
    const status = (err as { statusMessage?: string })?.statusMessage;
    if (status === "email_not_verified") {
      needsVerification.value = true;
      error.value = "Please verify your email to sign in.";
    } else {
      error.value = "Invalid email or password.";
    }
  }
}

async function resend() {
  try {
    await $fetch("/api/auth/resend-verification", {
      method: "POST",
      body: { email: credentials.email },
    });
    resent.value = true;
  } catch {
    /* swallow — endpoint returns 200 even on unknown addresses */
  }
}
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <h4>Sign in</h4>
      <form class="login-form" @submit.prevent="login">
        <input
          v-model="credentials.email"
          class="field-input"
          type="email"
          placeholder="Email"
          autocomplete="username"
          required
        />
        <input
          v-model="credentials.password"
          class="field-input"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          required
        />
        <button type="submit" class="btn btn-primary">Login</button>
      </form>
      <p v-if="error" class="msg msg--error">{{ error }}</p>
      <p v-if="needsVerification && !resent" class="msg">
        <button type="button" class="link-btn" @click="resend">
          Resend verification email
        </button>
      </p>
      <p v-if="resent" class="msg">Verification email sent. Check your inbox.</p>
    </div>
  </div>
</template>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger, #b91c1c);
}
.link-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}
</style>
