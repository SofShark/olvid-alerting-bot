<script setup lang="ts">
import type { User } from "#shared/types/user";
import type { InviteResponse } from "#shared/types/auth";

definePageMeta({ middleware: ["auth", "admin"] });

const { data: authConfig } = await useAuthConfig();
const mailEnabled = computed(() => authConfig.value?.mailEnabled ?? false);

const users = ref<User[]>([]);
const loading = ref(false);
const feedback = ref<string | null>(null);
const modalOpen = ref(false);

// Per-user clipboard cache for pending invites.
const inviteUrls = reactive<Record<number, string>>({});

async function load() {
  loading.value = true;
  try {
    users.value = await $fetch<User[]>("/api/users");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function copyText(text: string, note: string) {
  try {
    await navigator.clipboard.writeText(text);
    feedback.value = note;
  } catch {
    feedback.value = "Copy failed — select the value manually.";
  }
}

async function onInvited(res: InviteResponse) {
  inviteUrls[res.user.id] = res.inviteUrl;
  modalOpen.value = false;
  await load();
  if (res.mailed) {
    feedback.value = `Invitation emailed to ${res.user.email ?? res.user.login}.`;
  } else {
    await copyText(res.inviteUrl, `Invite link copied for ${res.user.login}.`);
  }
}

async function resendInvite(u: User) {
  feedback.value = null;
  try {
    const res = await $fetch<InviteResponse>(
      `/api/users/${u.id}/resend-invite`,
      { method: "POST" },
    );
    inviteUrls[u.id] = res.inviteUrl;
    feedback.value = res.mailed
      ? `Invitation re-sent to ${u.email ?? u.login}.`
      : `Invitation refreshed. Copy the link to share it manually.`;
  } catch {
    feedback.value = "Could not resend the invitation.";
  }
}

async function copyInviteLink(u: User) {
  feedback.value = null;
  let url = inviteUrls[u.id];
  if (!url) {
    try {
      const res = await $fetch<InviteResponse>(
        `/api/users/${u.id}/resend-invite`,
        { method: "POST" },
      );
      url = res.inviteUrl;
      inviteUrls[u.id] = url;
    } catch {
      feedback.value = "Could not generate a fresh invite link.";
      return;
    }
  }
  await copyText(url, `Invite link copied for ${u.login}.`);
}

async function remove(u: User) {
  if (!confirm(`Delete user ${u.login}?`)) return;
  feedback.value = null;
  try {
    await $fetch(`/api/users/${u.id}`, { method: "DELETE" });
    delete inviteUrls[u.id];
    await load();
  } catch (err: unknown) {
    const status = (err as { statusMessage?: string })?.statusMessage;
    feedback.value =
      status === "cannot_delete_self"
        ? "You cannot delete your own account."
        : status === "cannot_delete_last_admin"
          ? "There must be at least one admin."
          : "Could not delete this user.";
  }
}

// Is this row's `login` also a valid-looking email address? Used only
// to decide whether to render the ✉ marker next to it — the source of
// truth for "reachable by email" is still the `email` column.
function loginIsEmail(u: User): boolean {
  return u.email !== null && u.email === u.login;
}

function isPendingInvite(u: User): boolean {
  return !u.activated;
}
</script>

<template>
  <div class="users-panel">
    <header class="users-head">
      <h2>{{ $t("user.pageTitle") }}</h2>
      <button
        type="button"
        class="btn btn-primary"
        @click="modalOpen = true"
      >
        Invite user
      </button>
    </header>

    <p v-if="feedback && !modalOpen" class="feedback">{{ feedback }}</p>

    <table v-if="!loading" class="users-table">
      <thead>
        <tr>
          <th>Login</th>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>
            <div class="login-cell">
              <!-- ✉ tag marks logins that also work as a mail address. -->
              <span
                v-if="loginIsEmail(u)"
                class="channel-tag"
                title="Login is an email address"
                aria-label="Login is an email address"
              >
                <LucideMail :stroke-width="2" />
              </span>
              <span
                v-else
                class="channel-tag"
                title="Local username (no email delivery)"
                aria-label="Local username"
              >
                <LucideUser :stroke-width="2" />
              </span>
              <span class="login-value">{{ u.login }}</span>
              <!-- If the row has a separate email (rare — invite created
                   with a distinct email column), show it as a subtitle. -->
              <span
                v-if="u.email && u.email !== u.login"
                class="login-subtitle"
              >
                ({{ u.email }})
              </span>
            </div>
          </td>
          <td>{{ u.name ?? "—" }}</td>
          <td>{{ u.role === "admin" 
                ? $t("user.userRow.role.admin") 
                : $t("user.userRow.role.user" ) }}</td>
          <td>
            {{
              u.activated
                ? $t("user.userRow.status.active")
                : $t("user.userRow.status.pending")
            }}
          </td>
          <td class="actions">
            <button
              v-if="isPendingInvite(u)"
              type="button"
              class="btn btn-ghost"
              :title="inviteUrls[u.id] || 'Generate & copy an invite link'"
              @click="copyInviteLink(u)"
            >
              Copy link
            </button>
            <button
              v-if="isPendingInvite(u) && mailEnabled && u.email"
              type="button"
              class="btn btn-ghost"
              @click="resendInvite(u)"
            >
              Resend
            </button>
            <button
              type="button"
              class="btn btn-danger-ghost"
              @click="remove(u)"
            >
              {{ $t("button.delete") }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <UserInviteModal
      :open="modalOpen"
      :mail-enabled="mailEnabled"
      @close="modalOpen = false"
      @invited="onInvited"
    />
  </div>
</template>

<style scoped>
.users-panel {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}
.users-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.feedback {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.users-table th,
.users-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--color-border-subtle);
}
.actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  flex-wrap: wrap;
}

.login-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.channel-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--color-accent);
  flex-shrink: 0;
}

.channel-tag :deep(svg) {
  width: 14px;
  height: 14px;
}
.login-value {
  font-family: var(--font-mono);
}
.login-subtitle {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

</style>
