<script setup lang="ts">
import type { SetupForm } from "#shared/types/auth";

// First-run admin creation. Two independent gates:
//   1. ADMIN_KEY from .env — the operator proves they control the
//      deploy. Server-side timing-safe check.
//   2. SMTP presence decides whether we collect an email + fire a
//      verification link, or a plain username + activate immediately.

const { t } = useI18n();
const { data: authConfig, refresh: refreshAuthConfig } = await useAuthConfig();
const { fetch: refreshSession } = useUserSession();
const { mapAuthError } = useAuthErrors();
const setupErrorMap = {
  admin_key_not_configured: t("auth.setup.errorAdminKeyNotConfigured"),
  invalid_admin_key: t("auth.setup.errorInvalidAdminKey"),
  setup_already_complete: t("auth.setup.errorAlreadyComplete"),
};

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
    const res = await authService.setup({
      adminKey: form.adminKey,
      login: mailEnabled.value ? form.email ?? "" : form.login,
      email: mailEnabled.value ? form.email : undefined,
      password: form.password,
      name: form.name || undefined,
    });
    await refreshAuthConfig();

    if (res.requiresVerification) {
      done.value = true;
    } else {
      await refreshSession();
      await navigateTo("/");
    }
  } catch (err: unknown) {
    error.value = mapAuthError(err, setupErrorMap, t("auth.setup.errorFallback"));
  }
}
</script>

<template>
  <AuthCard>
    <template v-if="!done">
      <h4>{{ $t("auth.setup.title") }}</h4>
      <p class="hint">{{ $t("auth.setup.hint") }}</p>
      <form class="setup-form" @submit.prevent="submit">
        <input
          v-model="form.adminKey"
          class="field-input"
          type="password"
          :placeholder="$t('auth.setup.adminKey')"
          autocomplete="off"
          required
        />
        <input
          v-model="form.name"
          class="field-input"
          type="text"
          :placeholder="$t('auth.setup.namePlaceholder')"
          autocomplete="name"
        />

        <!-- SMTP configured → collect email as the login. -->
        <input
          v-if="mailEnabled"
          v-model="form.email"
          class="field-input"
          type="email"
          :placeholder="$t('auth.setup.emailPlaceholder')"
          autocomplete="username"
          required
        />
        <!-- SMTP off → collect a plain username instead. -->
        <input
          v-else
          v-model="form.login"
          class="field-input"
          type="text"
          :placeholder="$t('auth.setup.usernamePlaceholder')"
          autocomplete="username"
          required
        />

        <input
          v-model="form.password"
          class="field-input"
          type="password"
          :placeholder="$t('auth.setup.passwordPlaceholder')"
          autocomplete="new-password"
          minlength="8"
          required
        />
        <button type="submit" class="btn btn-primary">
          {{ $t("auth.setup.submit") }}
        </button>
      </form>
      <p v-if="error" class="msg msg--error">{{ error }}</p>
      <p v-if="!mailEnabled" class="hint hint--small">
        {{ $t("auth.setup.noSmtpHint") }}
      </p>
    </template>

    <template v-else>
      <h4>{{ $t("auth.setup.doneTitle") }}</h4>
      <i18n-t keypath="auth.setup.doneBody" tag="p" class="hint">
        <template #email>
          <strong>{{ form.email }}</strong>
        </template>
      </i18n-t>
      <NuxtLink to="/login" class="btn btn-primary">
        {{ $t("auth.setup.doneCta") }}
      </NuxtLink>
    </template>
  </AuthCard>
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
