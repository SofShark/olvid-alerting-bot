<script setup lang="ts">
import type { CredentialsForm } from "#shared/types/auth";

const { fetch: refreshSession } = useUserSession();
const { data: authConfig } = await useAuthConfig();

const credentials = reactive<CredentialsForm>({ login: "", password: "" });
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
    if (status === "account_not_activated") {
      needsVerification.value = true;
      error.value = "Your account isn't activated yet. Check your invite email.";
    } else {
      error.value = "Invalid credentials.";
    }
  }
}

// Resend affordance only makes sense when SMTP is on — the endpoint
// is a no-op otherwise. And it's keyed by email, so we only offer it
// when the login the user typed looks like an address.
const canResend = computed(
  () => authConfig.value?.mailEnabled && credentials.login.includes("@"),
);

async function resend() {
  try {
    await $fetch("/api/auth/resend-verification", {
      method: "POST",
      body: { email: credentials.login },
    });
    resent.value = true;
  } catch {
    /* silent — endpoint returns 200 on unknown addresses on purpose */
  }
}

const loginLabel = computed(() =>
  authConfig.value?.mailEnabled ? "Email or username" : "Username",
);
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <h4>Sign in</h4>
      <form class="login-form" @submit.prevent="login">
        <input
          v-model="credentials.login"
          class="field-input"
          type="text"
          :placeholder="loginLabel"
          required
        />
        <input
          v-model="credentials.password"
          class="field-input"
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" class="btn btn-primary">Login</button>
      </form>
      <p v-if="error" class="msg msg--error">{{ error }}</p>
      <p v-if="needsVerification && canResend && !resent" class="msg">
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
