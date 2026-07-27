<script setup lang="ts">
import type { UserRole } from "#shared/types/user";
import type { InviteResponse, InviteUserForm } from "#shared/types/auth";

/*
  Two-path invite modal. The parent owns:
    - `open` state (this component just reflects it)
    - what to do with the result (cache URL, refresh table, show toast)

  This component owns:
    - the two peer forms (mail path / link path)
    - per-form busy flags
    - inline error feedback (errors from POST /api/users/invite that
      would otherwise render behind the teleported overlay)

  On a successful invite it emits `invited` with the raw response and
  clears its own state; the parent decides whether to close the modal
  (typically yes — same UX as before the extract).
*/

const props = defineProps<{ open: boolean; mailEnabled: boolean }>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "invited", res: InviteResponse): void;
}>();

const { t } = useI18n();

// Role is shared across both forms — the admin's choice shouldn't
// disappear if they switch which section they submit from.
const role = ref<UserRole>("user");

const mailForm = reactive<{ email: string; name: string }>({
  email: "",
  name: "",
});
const linkForm = reactive<{ login: string; name: string }>({
  login: "",
  name: "",
});

const busyMail = ref(false);
const busyLink = ref(false);
const feedback = ref<string | null>(null);

const roleOptions = computed(() => [
  { value: "user", label: t("user.userRow.role.user") },
  { value: "admin", label: t("user.userRow.role.admin") },
]);

function reset() {
  role.value = "user";
  mailForm.email = "";
  mailForm.name = "";
  linkForm.login = "";
  linkForm.name = "";
  feedback.value = null;
}

// Reset the two forms every time the parent opens the modal, so a
// previous session's typed values don't leak into the next invite.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reset();
  },
);

function describeError(err: unknown): string {
  const status = (err as { statusMessage?: string })?.statusMessage;
  switch (status) { // TODO i18n
    case "user_already_active":
      return "That user already has an active account.";
    case "invite_needs_identifier":
      return "Provide an email or a username.";
    case "email_required":
      return "Email is required for a mail invite.";
    case "mail_not_configured":
      return "SMTP is not configured on this deploy.";
    default:
      return "Could not create the invitation.";
  }
}

async function submitMail() {
  if (!mailForm.email) return;
  feedback.value = null;
  busyMail.value = true;
  try {
    const res = await $fetch<InviteResponse>("/api/users/invite", {
      method: "POST",
      body: {
        email: mailForm.email,
        role: role.value,
        name: mailForm.name || undefined,
        sendMail: true,
      } satisfies InviteUserForm,
    });
    emit("invited", res);
  } catch (err) {
    feedback.value = describeError(err);
  } finally {
    busyMail.value = false;
  }
}

async function submitLink() {
  if (!linkForm.login) return;
  feedback.value = null;
  busyLink.value = true;
  try {
    const res = await $fetch<InviteResponse>("/api/users/invite", {
      method: "POST",
      body: {
        login: linkForm.login,
        role: role.value,
        name: linkForm.name || undefined,
        sendMail: false,
      } satisfies InviteUserForm,
    });
    emit("invited", res);
  } catch (err) {
    feedback.value = describeError(err);
  } finally {
    busyLink.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    size="default"
    aria-label="Invite user"
    @close="emit('close')"
  >
    <ModalHead title="Invite a new user" @close="emit('close')" />

    <div class="modal-body">
      <p v-if="feedback" class="modal-feedback">{{ feedback }}</p>

      <!-- Section 1: mail invite — only when SMTP is available. -->
      <section v-if="mailEnabled" class="invite-section">
        <h5 class="section-title">Send an email invitation</h5>
        <p class="section-hint">
          An invitation link is sent to the address; the user sets
          their password on arrival.
        </p>
        <form class="invite-form" @submit.prevent="submitMail">
          <label class="field">
            <span class="field-label">Email</span>
            <input
              v-model="mailForm.email"
              class="field-input"
              type="email"
              placeholder="teammate@example.com"
              autocomplete="off"
              required
            />
          </label>
          <label class="field">
            <span class="field-label">Name (optional)</span>
            <input
              v-model="mailForm.name"
              class="field-input"
              type="text"
              placeholder="Sofia"
            />
          </label>
          <div class="field">
            <span class="field-label">Role</span>

            <div class="btn-pill-group">
              <button
                v-for="opt in roleOptions"
                :key="opt.value"
                type="button"
                class="btn-pill"
                :class="{ active: role === opt.value as UserRole }"
                @click="role = opt.value as UserRole"
              >
                <input type="radio" :checked="role === opt.value" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
            
          </div>
          <div class="section-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="busyMail"
            >
              {{ busyMail ? "Sending…" : "Send by email" }}
            </button>
          </div>
        </form>
      </section>

      <div v-if="mailEnabled" class="section-divider"><span>or</span></div>

      <!-- Section 2: link-only invite — always available. -->
      <section class="invite-section">
        <h5 class="section-title">Create a shareable invite link</h5>
        <p class="section-hint">
          Pick a username. The link is copied to your clipboard —
          share it through any channel.
        </p>
        <form class="invite-form" @submit.prevent="submitLink">
          <label class="field">
            <span class="field-label">Username (login)</span>
            <input
              v-model="linkForm.login"
              class="field-input"
              type="text"
              placeholder="alice"
              autocomplete="off"
              required
            />
          </label>
          <label class="field">
            <span class="field-label">Name (optional)</span>
            <input
              v-model="linkForm.name"
              class="field-input"
              type="text"
              placeholder="Alice"
            />
          </label>
          <div class="field">
            <span class="field-label">Role</span>
            <div class="btn-pill-group">
              <button
                v-for="opt in roleOptions"
                :key="opt.value"
                type="button"
                class="btn-pill"
                :class="{ active: role === opt.value as UserRole }"
                @click="role = opt.value as UserRole"
              >
                <input type="radio" :checked="role === opt.value" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>
          <div class="section-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="busyLink"
            >
              {{ busyLink ? "Creating…" : "Create & copy link" }}
            </button>
          </div>
        </form>
      </section>

      <div class="overlay-actions">
        <button type="button" class="btn btn-ghost" @click="emit('close')">
          Close
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.modal-body {
  padding: 0 var(--space-6) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.modal-feedback {
  color: var(--color-danger, #b91c1c);
  font-size: var(--text-sm);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-danger-soft, rgba(185, 28, 28, 0.08));
  border-radius: var(--radius-md);
}

.invite-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.section-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
}
.section-hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.section-actions {
  display: flex;
  justify-content: flex-end;
}
.section-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-dim);
  font-size: var(--text-sm);
}
.section-divider::before,
.section-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--color-border-subtle);
}

.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.field-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Segmented radio-pill group. One button per role; the selected pill
 * gets the accent fill. Uses role=radiogroup + role=radio so screen
 * readers announce it as a set instead of arbitrary buttons. */
.role-pills {
  display: inline-flex;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  align-self: flex-start;
}
.role-pill {
  background: transparent;
  border: none;
  padding: 6px 14px;
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.role-pill + .role-pill {
  border-left: 1px solid var(--color-border-default);
}
.role-pill:hover:not(.selected) {
  background: var(--color-bg-card-soft);
  color: var(--color-text-primary);
}
.role-pill.selected {
  background: var(--color-accent-soft);
  color: var(--color-accent-text, var(--color-accent));
  font-weight: 600;
}
.role-pill:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}
</style>
