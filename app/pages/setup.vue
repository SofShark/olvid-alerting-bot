<script setup lang="ts">
import type { SetupForm } from "#shared/types/auth";

const form = reactive<SetupForm>({ email: "", password: "", name: "" });
const error = ref<string | null>(null);
const done = ref(false);

async function submit() {
  error.value = null;
  try {
    await $fetch("/api/auth/setup", {
      method: "POST",
      body: {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
      },
    });
    done.value = true;
  } catch (err: unknown) {
    const status = (err as { statusMessage?: string })?.statusMessage;
    error.value =
      status === "Setup already complete"
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
          No admin exists on this deploy yet. Create the account that will
          manage the alerting bot from here on.
        </p>
        <form class="setup-form" @submit.prevent="submit">
          <input
            v-model="form.name"
            class="field-input"
            type="text"
            placeholder="Name (optional)"
            autocomplete="name"
          />
          <input
            v-model="form.email"
            class="field-input"
            type="email"
            placeholder="Email"
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
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger, #b91c1c);
}
</style>
