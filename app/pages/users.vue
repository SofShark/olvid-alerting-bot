<script setup lang="ts">
import type { User } from "#shared/types/user";
import { useUserAdmin } from "~/composables/useUserAdmin";

definePageMeta({ middleware: ["auth", "admin"] });

const { data: authConfig } = await useAuthConfig();
const mailEnabled = computed(() => authConfig.value?.mailEnabled ?? false);

const {
  users,
  loading,
  feedback,
  inviteUrls,
  revealedInvite,
  pendingDelete,
  load,
  onInvited,
  closeReveal,
  resendInvite,
  copyInviteLink,
  askRemove,
  cancelRemove,
  confirmRemove,
} = useUserAdmin();

const modalOpen = ref(false);

onMounted(load);

function loginIsEmail(u: User): boolean {
  return u.email !== null && u.email === u.login;
}

function isPendingInvite(u: User): boolean {
  return !u.activated;
}

// Route the invite modal's success event through the composable and
// close the modal — the composable decides between feedback line and
// reveal modal based on the mailed flag.
async function handleInvited(res: Parameters<typeof onInvited>[0]) {
  modalOpen.value = false;
  await onInvited(res);
}
</script>

<template>
  <div class="users-panel">
    <header class="users-head">
      <h2>{{ $t("user.pageTitle") }}</h2>
      <button type="button" class="btn btn-primary" @click="modalOpen = true">
        {{ $t("auth.users.inviteButton") }}
      </button>
    </header>

    <p v-if="feedback && !modalOpen" class="feedback">{{ feedback }}</p>

    <table v-if="!loading" class="users-table">
      <thead>
        <tr>
          <th>{{ $t("auth.users.table.login") }}</th>
          <th>{{ $t("auth.users.table.name") }}</th>
          <th>{{ $t("auth.users.table.role") }}</th>
          <th>{{ $t("auth.users.table.status") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>
            <div class="login-cell">
              <span
                v-if="loginIsEmail(u)"
                class="channel-tag"
                :title="$t('auth.users.loginTagEmail')"
                :aria-label="$t('auth.users.loginTagEmail')"
              >
                <LucideMail :stroke-width="2" />
              </span>
              
              <span
                v-else
                class="channel-tag"
                :title="$t('auth.users.loginTagLocal')"
                :aria-label="$t('auth.users.loginTagLocalShort')"
              >
                <LucideUser :stroke-width="2" />
              </span>
              <span class="login-value">{{ u.login }}</span>
              <span
                v-if="u.email && u.email !== u.login"
                class="login-subtitle"
              >
                ({{ u.email }})
              </span>
            </div>
          </td>
          <td>
            <div class="name-cell">
              <span :class="{ 'name-empty': !u.name }">
                {{ u.name ?? "—" }}
              </span>
            </div>
          </td>
          <td>
            {{
              u.role === "admin"
                ? $t("user.userRow.role.admin")
                : $t("user.userRow.role.user")
            }}
          </td>
          <td>
            <div class="status-cell">
              <span
                class="status-badge"
                :class="{
                  'status-badge--registered': u.activated,
                  'status-badge--pending': !u.activated,
                }"
              >
                {{
                  u.activated
                    ? $t("user.userRow.status.registered")
                    : $t("user.userRow.status.pending")
                }}
              </span>

              <button
                v-if="isPendingInvite(u)"
                type="button"
                class="btn-icon btn-copy-link"
                :title="inviteUrls[u.id] || $t('auth.users.copyLinkTitle')"
                @click="copyInviteLink(u)"
              >
                <LucideLink />
              </button>

              <button
                v-if="isPendingInvite(u) && mailEnabled && u.email"
                type="button"
                class="btn-icon"
                :title="$t('auth.users.resendTitle')"
                @click="resendInvite(u)"
              >
                <LucideRedo />
              </button>
            </div>
          </td>
          <td>
            <div class="actions-wrap">
              <button
                type="button"
                class="btn btn-sm btn-danger-ghost"
                @click="askRemove(u)"
              >
                {{ $t("button.delete") }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <UserInviteModal
      :open="modalOpen"
      :mail-enabled="mailEnabled"
      @close="modalOpen = false"
      @invited="handleInvited"
    />

    <InviteRevealModal :invite="revealedInvite" @close="closeReveal" />

    <ConfirmDialog
      :open="pendingDelete !== null"
      :title="$t('button.delete')"
      :message="
        pendingDelete
          ? $t('auth.users.confirmDeletePrompt', { login: pendingDelete.login })
          : ''
      "
      :confirm-label="$t('button.delete')"
      :cancel-label="$t('button.cancel')"
      variant="danger"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
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

/* ── Table chrome ────────────────────────────────────────────── */
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.users-table th,
.users-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border-subtle);
}
.users-table th {
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.actions-wrap {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* ── Login cell ──────────────────────────────────────────────── */
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
  font-family: var(--font-sans);
}
.login-subtitle {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

/* ── Status cell — badge + action icons on one baseline ─────── */
.status-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* ── Name cell ───────────────────────────────── */
.name-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.name-empty {
  color: var(--color-text-dim);
}

/* ── Status badge ─────────────────────────────────────────────── */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: 500;
}
.status-badge--registered {
  background: var(--color-success-soft, rgba(34, 197, 94, 0.12));
  color: var(--color-success, #16a34a);
}
.status-badge--pending {
  background: var(--color-warn-soft, rgba(234, 179, 8, 0.14));
  color: var(--color-warn, #a16207);
}
</style>
