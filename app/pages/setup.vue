<script setup lang="ts">
import type { SetupForm } from "#shared/types/auth";

// First-run admin creation. Two independent gates:
//   1. ADMIN_KEY from .env — the operator proves they control the
//      deploy. Server-side timing-safe check.
//   2. SMTP presence decides whether we collect an email + fire a
//      verification link, or a plain username + activate immediately.

const { data: authConfig, refresh: refreshAuthConfig } = await useAuthConfig();
const { fetch: refreshSession } = useUserSession();

const form = reactive<SetupForm>({
  adminKey: "",
  login: "",
  email: "",
  password: "",
  name: "",
});
const error = ref<string | null>(null);
const done = ref(false);

const mailEnabled = computed(() => authConfig.value?.mailEnabled ?? false);

async function submit() {
  error.value = null;
  try {
    const res = await $fetch<{
      requiresVerification: boolean;
    }>("/api/auth/setup", {
      method: "POST",
      body: {
        adminKey: form.adminKey,
        login: mailEnabled.value ? form.email : form.login,
        email: mailEnabled.value ? form.email : undefined,
        password: form.password,
        name: form.name || undefined,
      },
    });
    await refreshAuthConfig();

    if (res.requiresVerification) {
      done.value = true;
    } else {
      await refreshSession();
      await navigateTo("/");
    }
  } catch (err: unknown) {
    const status = (err as { statusMessage?: string })?.statusMessage;
    error.value =
      status === "admin_key_not_configured"
        ? "ADMIN_KEY is not set on the server. Configure it in .env and restart."
        : status === "invalid_admin_key"
          ? "That admin key doesn't match the one configured on the server."
          : status === "setup_already_complete"
            ? "An admin already exists on this deploy."
            : "Could not create the admin account. Check the inputs and try again.";
  }
}
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <template v-if="!done">
        <h4>Create the first admin</h4>
        <p class="hint">
          Paste the <code>ADMIN_KEY</code> from your <code>.env</code> to
          prove you deployed this instance, then fill in your details.
        </p>
        <form class="setup-form" @submit.prevent="submit">
          <input
            v-model="form.adminKey"
            class="field-input"
            type="password"
            placeholder="ADMIN_KEY"
            autocomplete="off"
            required
          />
          <input
            v-model="form.name"
            class="field-input"
            type="text"
            placeholder="Name (optional)"
            autocomplete="name"
          />

          <!-- SMTP configured → collect email as the login. -->
          <input
            v-if="mailEnabled"
            v-model="form.email"
            class="field-input"
            type="email"
            placeholder="Email"
            autocomplete="username"
            required
          />
          <!-- SMTP off → collect a plain username instead. -->
          <input
            v-else
            v-model="form.login"
            class="field-input"
            type="text"
            placeholder="Username"
            autocomplete="username"
            required
          />

          <input
            v-model="form.password"
            class="field-input"
            type="password"
            placeholder="Password (min 8 chars)"
            autocomplete="new-password"
            minlength="8"
            required
          />
          <button type="submit" class="btn btn-primary">Create admin</button>
        </form>
        <p v-if="error" class="msg msg--error">{{ error }}</p>
        <p v-if="!mailEnabled" class="hint hint--small">
          SMTP is not configured on this deploy — you'll be signed in
          directly after creating the account (no email verification).
        </p>
      </template>

      <template v-else>
        <h4>Check your inbox</h4>
        <p class="hint">
          A verification link has been sent to
          <strong>{{ form.email }}</strong
          >. Click it to activate the account, then sign in.
        </p>
        <NuxtLink to="/login" class="btn btn-primary">Go to login</NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.setup-form {
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
.hint code {
  background: var(--color-bg-panel);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--font-mono);
}
.hint--small {
  font-size: var(--text-xs);
}
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger, #b91c1c);
}
</style>
