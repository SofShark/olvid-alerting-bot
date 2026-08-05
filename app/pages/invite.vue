<script setup lang="ts">
import type { AcceptInviteForm } from "#shared/types/auth";

// Invite acceptance page. Login, name, and role were set by the
// admin at invite time — the only thing the user picks here is a
// password. On success we activate the account, sign the user in,
// and drop them on /.

const route = useRoute();
const { t } = useI18n();
const { fetch: refreshSession } = useUserSession();
const { mapAuthError } = useAuthErrors();
const acceptErrorMap = {
  token_invalid: t("auth.invite.errorTokenInvalid"),
  bad_request: t("auth.invite.errorBadPassword"),
};

const token = computed(() => {
  const t = route.query.token;
  return typeof t === "string" ? t : "";
});

const form = reactive<AcceptInviteForm>({ token: "", password: "" });

const confirmPassword = ref("");
watchEffect(() => (form.token = token.value));

const error = ref<string | null>(null);

// Peek at the invite (no side effect) to surface which account the user
// is activating. useFetch handles cancellation when `token` changes, so
// a stale response can't overwrite a newer one. Only a 4xx from the
// server (token invalid / expired / used) should collapse the hint to
// generic wording — a network drop is a distinct failure that the user
// will notice on submit anyway, and we don't want to imply their invite
// is bad when their wifi flaked.
const { data: inviteInfo } = await useFetch<{
  login: string;
  name: string | null;
}>(AUTH_ENDPOINTS.inviteInfo, {
  query: { token },
  server: false,
  immediate: true,
  watch: [token],
  // Suppress Nuxt's automatic error propagation — an invalid token
  // shouldn't blow the whole page up; we just render without the login hint.
  onResponseError() {},
});
const invitedLogin = computed(() => inviteInfo.value?.login ?? null);

async function submit() {
  error.value = null;
  if (!form.token) {
    error.value = t("auth.invite.errorMissingToken");
    return;
  }
  if (form.password !== confirmPassword.value) {
    error.value = t("auth.invite.errorPasswordsDoNotMatch");
    return;
  }

  try {
    await authService.acceptInvite({
      token: form.token,
      password: form.password,
    });
    await refreshSession();
    await navigateTo("/");
  } catch (err) {
    // Anything the server explicitly returns (token_invalid /
    // bad_request) has a shaped statusMessage; anything else (fetch
    // failed, 500, offline) collapses into the fallback so the user is
    // told to retry rather than that their invite is dead.
    error.value = mapAuthError(
      err,
      acceptErrorMap,
      t("auth.invite.errorNetwork"),
    );
  }
}
</script>

<template>
  <AuthCard>
    <h4>{{ $t("auth.invite.title") }}</h4>
    <p class="hint">
      <template v-if="invitedLogin">
        <i18n-t keypath="auth.invite.hintPasswordWithLogin" tag="span">
          <template #login>
            <strong class="hint-login">{{ invitedLogin }}</strong>
          </template>
        </i18n-t>
      </template>
      <template v-else>{{ $t("auth.invite.hintPassword") }}</template>
    </p>
    <form class="invite-form" @submit.prevent="submit">
      <input
        v-model="form.password"
        class="field-input"
        type="password"
        :placeholder="$t('auth.invite.passwordPlaceholder')"
        autocomplete="new-password"
        minlength="8"
        required
      />
      <input
        v-model="confirmPassword"
        class="field-input"
        type="password"
        :placeholder="$t('auth.invite.confirmPasswordPlaceholder')"
        autocomplete="new-password"
        minlength="8"
        required
      />
      <button type="submit" class="btn btn-primary">
        {{ $t("auth.invite.submit") }}
      </button>
    </form>
    <p v-if="error" class="msg msg--error">{{ error }}</p>
  </AuthCard>
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
.hint-login {
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger-strong, var(--color-danger, #b91c1c));
}
</style>
