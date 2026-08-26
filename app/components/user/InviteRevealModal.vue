<script setup lang="ts">
// Post-invite reveal modal. Opens after a link-path invite (no mail) so
// the admin sees the newly-created user's invite URL and copies it out
// of band.
import type { InviteResponse } from "#shared/types/auth";

defineProps<{ invite: InviteResponse | null }>();
defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <Modal
    :open="invite !== null"
    size="wide"
    :aria-label="$t('auth.reveal.ariaLabel')"
    @close="$emit('close')"
  >
    <ModalHead :title="$t('auth.reveal.title')" @close="$emit('close')" />
    <div class="reveal-body">
      <i18n-t
        v-if="invite"
        keypath="auth.reveal.body"
        tag="p"
        class="reveal-message"
      >
        <template #role>
          <strong>{{ invite.user.role }}</strong>
        </template>
        <template #login>
          <strong>{{ invite.user.login }}</strong>
        </template>
      </i18n-t>
      <URLCopyBox v-if="invite" :url="invite.inviteUrl" />
      <div class="overlay-actions">
        <button type="button" class="btn btn-ghost" @click="$emit('close')">
          {{ $t("auth.reveal.close") }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.reveal-body {
  padding: 0 var(--space-5) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.reveal-message {
  color: var(--color-text-secondary);
  font-size: var(--text-s);
  margin: 0;
}
</style>
