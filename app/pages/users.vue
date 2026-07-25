<script setup lang="ts">
import type { User, UserRole } from "#shared/types/user";
import type { InviteUserForm } from "#shared/types/auth";

definePageMeta({ middleware: ["auth", "admin"] });

const users = ref<User[]>([]);
const loading = ref(false);
const inviting = ref(false);
const inviteForm = reactive<InviteUserForm>({
  email: "",
  role: "user",
});
const showInviteForm = ref(false);
const feedback = ref<string | null>(null);

async function load() {
  loading.value = true;
  try {
    users.value = await $fetch<User[]>("/api/users");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function invite() {
  feedback.value = null;
  inviting.value = true;
  try {
    await $fetch("/api/users/invite", {
      method: "POST",
      body: {
        email: inviteForm.email,
        role: inviteForm.role,
      },
    });
    feedback.value = `Invitation sent to ${inviteForm.email}.`;
    inviteForm.email = "";
    inviteForm.role = "user";
    showInviteForm.value = false;
    await load();
  } catch (err: unknown) {
    const status = (err as { statusMessage?: string })?.statusMessage;
    feedback.value =
      status === "user_already_active"
        ? "That user already has an active account."
        : "Could not send the invitation.";
  } finally {
    inviting.value = false;
  }
}

async function resendInvite(u: User) {
  feedback.value = null;
  try {
    await $fetch(`/api/users/${u.id}/resend-invite`, { method: "POST" });
    feedback.value = `Invitation resent to ${u.email}.`;
  } catch {
    feedback.value = "Could not resend the invitation.";
  }
}

async function remove(u: User) {
  if (!confirm(`Delete user ${u.email}?`)) return;
  feedback.value = null;
  try {
    await $fetch(`/api/users/${u.id}`, { method: "DELETE" });
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

// unverified = never verified their email AND never activated a password;
// used to decide whether to offer "resend invite" vs the (future)
// password-reset action.
function isPendingInvite(u: User): boolean {
  return !u.emailVerified;
}

// TODO: i18n
const roleOptions = computed(() => [
  { value: "user", label: "User"},
  { value: "admin", label: "Admin"},
]);
</script>

<template>
  <div class="users-panel">
    <header class="users-head">
      <h2>Users</h2>
      <button
        type="button"
        class="btn btn-primary"
        @click="showInviteForm = !showInviteForm"
      >
        {{ showInviteForm ? "Cancel" : "Invite user" }}
      </button>
    </header>

    <form v-if="showInviteForm" class="invite-form" @submit.prevent="invite">
      <input
        v-model="inviteForm.email"
        class="field-input"
        type="email"
        placeholder="Email"
        required
      />

      <Select
          :model-value="inviteForm.role ?? 'user'"
          :options="roleOptions"
          size="sm"
          @update:model-value="inviteForm.role = ($event as UserRole)"
        />
      <button type="submit" class="btn btn-primary" :disabled="inviting">
        Send invitation
      </button>
    </form>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <table v-if="!loading" class="users-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.email }}</td>
          <td>{{ u.name ?? "—" }}</td>
          <td>{{ u.role }}</td>
          <td>{{ u.emailVerified ? "Active" : "Pending invite" }}</td>
          <td class="actions">
            <button
              v-if="isPendingInvite(u)"
              type="button"
              class="btn btn-ghost"
              @click="resendInvite(u)"
            >
              Resend
            </button>
            <button type="button" class="btn btn-danger-ghost" @click="remove(u)">
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
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
.invite-form {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-3);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}
.invite-form .field-input {
  flex: 1 1 180px;
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
}

</style>
