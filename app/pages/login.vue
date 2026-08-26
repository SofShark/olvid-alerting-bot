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

/*
  The auth card has two modes:
    - "login"  → the credentials form (default).
    - "forgot" → login-only + a big centered "Re-send password" button.
                 On submit, the card body flips to a channel-specific
                 success / unreachable / network-error line.

  Switching modes replaces the card content entirely (no mixed
  affordances) so the user always sees one clear ask at a time.
*/
const mode = ref<"login" | "forgot">("login");
const forgotBusy = ref(false);
const forgotChannel = ref<ResetChannel | null>(null);
const forgotError = ref<string | null>(null);

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

// Resend-verification affordance only makes sense when SMTP is on and
// the login looks like an email.
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
  mode.value = "forgot";
  forgotChannel.value = null;
  forgotError.value = null;
  // Clear the password field — it's not shown in forgot mode and it
  // shouldn't survive a mode switch either way.
  credentials.password = "";
}

function backToLogin() {
  mode.value = "login";
  forgotChannel.value = null;
  forgotError.value = null;
  forgotBusy.value = false;
}

async function requestReset() {
  if (!credentials.login || forgotBusy.value) return;
  forgotBusy.value = true;
  forgotChannel.value = null;
  forgotError.value = null;
  try {
    const res = await authService.requestPasswordReset(credentials.login);
    forgotChannel.value = res.channel;
  } catch {
    // Endpoint returns 200 for unknown logins on purpose — a caught
    // throw here is a network error.
    forgotError.value = t("auth.login.resetNetworkError");
  } finally {
    forgotBusy.value = false;
  }
}

// The server always resolves to `channel: "none"` to avoid leaking whether
// the login exists or which channel it's bound to. The UI therefore shows
// a single generic "if we know you, we've sent something" message once the
// request completes — no branching by channel.
const forgotMessage = computed(() =>
  forgotChannel.value ? t("auth.login.resetSubmitted") : "",
);

const forgotOutcomeKind = computed<"success" | "warning" | null>(() =>
  forgotChannel.value ? "success" : null,
);
</script>

<template>
  <AuthCard>
    <!-- ── Login mode ────────────────────────────────────────────── -->
    <template v-if="mode === 'login'">
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

      <p v-if="needsVerification && canResend && !resent" class="msg">
        <button type="button" class="link-btn" @click="resend">
          {{ $t("auth.login.resendVerification") }}
        </button>
      </p>
      <p v-if="resent" class="msg">{{ $t("auth.login.verificationSent") }}</p>

      <div class="forgot-link-row">
        <button type="button" class="link-btn" @click="openForgot">
          {{ $t("auth.login.forgot") }}
        </button>
      </div>
    </template>

    <!-- ── Forgot-password mode ─────────────────────────────────── -->
    <template v-else>
      <h4>{{ $t("auth.login.forgotTitle") }}</h4>
      <p class="msg forgot-hint">{{ $t("auth.login.forgotHint") }}</p>

      <form class="forgot-form" @submit.prevent="requestReset">
        <input
          v-model="credentials.login"
          class="field-input"
          type="text"
          :placeholder="loginLabel"
          :disabled="!!forgotChannel"
          required
        />
        <button
          v-if="!forgotChannel"
          type="submit"
          class="btn btn-primary forgot-submit"
          :disabled="!credentials.login || forgotBusy"
        >
          {{
            forgotBusy
              ? $t("auth.login.forgotBusy")
              : $t("auth.login.forgotSubmit")
          }}
        </button>
      </form>

      <p
        v-if="forgotOutcomeKind"
        class="msg forgot-outcome"
        :class="{
          'msg--success': forgotOutcomeKind === 'success',
          'msg--muted': forgotOutcomeKind === 'warning',
        }"
      >
        {{ forgotMessage }}
      </p>
      <p v-if="forgotError" class="msg msg--error forgot-outcome">
        {{ forgotError }}
      </p>

      <div class="forgot-link-row">
        <button type="button" class="link-btn" @click="backToLogin">
          {{ $t("auth.login.forgotBackToLogin") }}
        </button>
      </div>
    </template>
  </AuthCard>
</template>

<style scoped>
.login-form,
.forgot-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.forgot-hint {
  margin-top: var(--space-3);
}

.forgot-submit {
  align-self: center;
  min-width: 180px;
}

.msg {
  margin-top: var(--space-3);
  font-size: var(--text-s);
  color: var(--color-text-muted);
}
.msg--error {
  color: var(--color-danger);
}
.msg--muted {
  color: var(--color-text-faint);
}
.msg--success {
  color: var(--color-success-text, var(--color-success));
}

.forgot-outcome {
  text-align: center;
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font-size: var(--text-s);
}
.link-btn:hover {
  color: var(--color-accent-hover);
}

.forgot-link-row {
  margin-top: var(--space-4);
  display: flex;
  justify-content: center;
}
</style>
