<script setup lang="ts">
import type { CredentialsForm, ResetChannel } from "#shared/types/auth";

const { t } = useI18n();
const { fetch: refreshSession } = useUserSession();
const { data: authConfig } = await useAuthConfig();
const { statusOf } = useAuthErrors();

const credentials = reactive<CredentialsForm>({ login: "", password: "" });
const error = ref<string | null>(null);
const needsVerification = ref(false);
const resent = ref(false);

// Forgot-my-password inline flow. Kept on the same page (no route
// change) so the user's typed login carries over automatically.
const forgotOpen = ref(false);
const forgotBusy = ref(false);
const forgotChannel = ref<ResetChannel | null>(null);

async function login() {
  error.value = null;
  needsVerification.value = false;
  resent.value = false;
  try {
    await authService.login(credentials);
    await refreshSession();
    await navigateTo("/");
  } catch (err: unknown) {
    if (statusOf(err) === "account_not_activated") {
      needsVerification.value = true;
      error.value = t("auth.login.errorNotActivated");
    } else {
      error.value = t("auth.login.errorInvalidCredentials");
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
    await authService.resendVerification(credentials.login);
    resent.value = true;
  } catch {
    /* silent — endpoint returns 200 on unknown addresses on purpose */
  }
}

const loginLabel = computed(() =>
  authConfig.value?.mailEnabled
    ? t("auth.login.identifierEmail")
    : t("auth.login.identifierUsername"),
);

// ── Forgot my password ────────────────────────────────────────────────
function openForgot() {
  forgotOpen.value = true;
  forgotChannel.value = null;
}

async function requestReset() {
  if (!credentials.login) return;
  forgotBusy.value = true;
  forgotChannel.value = null;
  try {
    const res = await authService.requestPasswordReset(credentials.login);
    forgotChannel.value = res.channel;
  } catch {
    // Endpoint returns 200 even for unknown logins — a caught throw
    // here is a network error. Surface as "check your connection".
    forgotChannel.value = null;
    error.value = t("auth.login.resetNetworkError");
  } finally {
    forgotBusy.value = false;
  }
}

const forgotMessage = computed(() => {
  switch (forgotChannel.value) {
    case "olvid":
      return t("auth.login.resetSentOlvid");
    case "mail":
      return t("auth.login.resetSentMail");
    case "none":
      return t("auth.login.resetUnreachable");
    default:
      return "";
  }
});
</script>

<template>
  <AuthCard>
    <h4>{{ $t("auth.login.title") }}</h4>
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
        :placeholder="$t('auth.login.password')"
        required
      />
      <button type="submit" class="btn btn-primary">
        {{ $t("auth.login.submit") }}
      </button>
    </form>

    <p v-if="error" class="msg msg--error">{{ error }}</p>

    <!-- Resend verification email — only when we know the account
         exists (server told us `account_not_activated`) and the login
         looks like an email address. -->
    <p v-if="needsVerification && canResend && !resent" class="msg">
      <button type="button" class="link-btn" @click="resend">
        {{ $t("auth.login.resendVerification") }}
      </button>
    </p>
    <p v-if="resent" class="msg">{{ $t("auth.login.verificationSent") }}</p>

    <!-- Forgot my password — inline (no route change). Once submitted,
         we render the channel-specific "check your inbox / DM" line
         and leave the affordance hidden to avoid spamming. -->
    <div class="forgot-block">
      <template v-if="!forgotOpen">
        <button type="button" class="link-btn" @click="openForgot">
          {{ $t("auth.login.forgot") }}
        </button>
      </template>

      <template v-else-if="!forgotChannel">
        <p class="msg">{{ $t("auth.login.forgotHint") }}</p>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="!credentials.login || forgotBusy"
          @click="requestReset"
        >
          {{
            forgotBusy
              ? $t("auth.login.forgotBusy")
              : $t("auth.login.forgotSubmit")
          }}
        </button>
      </template>

      <p v-else class="msg" :class="{ 'msg--muted': forgotChannel === 'none' }">
        {{ forgotMessage }}
      </p>
    </div>
  </AuthCard>
</template>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
}
.msg {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger);
}
.msg--muted {
  color: var(--color-text-faint);
}
.link-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font-size: var(--text-sm);
}
.link-btn:hover {
  color: var(--color-accent-hover);
}
.forgot-block {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

</style>
