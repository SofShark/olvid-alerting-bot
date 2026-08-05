// User-administration state + actions. Pulled out of pages/users.vue so
// the page stays a thin controller: it wires user-triggered events to
// composable methods and renders the response state. Reactive fields
// exposed here:
//   - users       : the current list, refreshed after every mutation.
//   - loading     : true while the initial /api/users list is in flight.
//   - feedback    : short user-facing message ("Invitation sent…"),
//                   cleared before every new mutation.
//   - inviteUrls  : per-user cache of the last invite URL we generated,
//                   so row-level "Copy link" is a one-tap operation.
//   - revealedInvite : the invite response currently displayed in the
//                   reveal modal (null when closed).
//   - pendingDelete  : the user pending a delete confirmation
//                   (null when the confirm dialog is closed).
//
// All fetch calls go through userService — no `$fetch` here.

import { reactive, ref } from "vue";
import type { User } from "#shared/types/user";
import type { InviteResponse } from "#shared/types/auth";
import { userService } from "~/utils/userService";
import { useAuthErrors } from "~/composables/useAuthErrors";

export function useUserAdmin() {
  const { t } = useI18n();
  const { mapAuthError } = useAuthErrors();
  const deleteErrorMap = {
    cannot_delete_self: t("auth.users.errorCannotDeleteSelf"),
    cannot_delete_last_admin: t("auth.users.errorCannotDeleteLastAdmin"),
  };
  const users = ref<User[]>([]);
  const loading = ref(false);
  const feedback = ref<string | null>(null);
  const inviteUrls = reactive<Record<number, string>>({});
  const revealedInvite = ref<InviteResponse | null>(null);
  const pendingDelete = ref<User | null>(null);

  async function load() {
    loading.value = true;
    try {
      users.value = await userService.list();
    } finally {
      loading.value = false;
    }
  }

  /**
   * Called by the invite modal on successful create. Caches the URL
   * for row-level "Copy link" and picks one of two follow-ups:
   *   - Manual "link" channel → open the reveal modal so the admin can
   *     copy the URL right now (that's the whole point of that path).
   *   - Delivered mail / Olvid → inline feedback line only. No modal,
   *     because the URL already reached the invitee and popping up a
   *     "here's the URL" modal on top of that would be noise.
   *   - Failed mail / Olvid → fall back to the reveal modal so the
   *     admin can still hand the link over out of band. The modal
   *     header + row-level "Copy link" affordance are all still there.
   */
  async function onInvited(res: InviteResponse) {
    inviteUrls[res.user.id] = res.inviteUrl;
    await load();

    const recipient =
      res.user.name ?? res.user.email ?? res.user.login;

    if (res.channel === "link") {
      // Manual path — always show the reveal so the admin can copy it.
      revealedInvite.value = res;
      return;
    }

    if (res.channel === "mail" && res.delivered) {
      feedback.value = t("auth.users.feedbackSent", {
        recipient,
        channel: t("auth.users.channelMail"),
      });
      return;
    }

    if (res.channel === "olvid" && res.delivered) {
      feedback.value = t("auth.users.feedbackSent", {
        recipient,
        channel: t("auth.users.channelOlvid"),
      });
      return;
    }

    // mail / olvid picked but delivery failed — surface the reveal so
    // the admin has a fallback path to hand over the URL.
    revealedInvite.value = res;
  }

  function closeReveal() {
    revealedInvite.value = null;
  }

  async function resendInvite(u: User) {
    feedback.value = null;
    try {
      const res = await userService.resendInvite(u.id);
      inviteUrls[u.id] = res.inviteUrl;
      const recipient = u.name ?? u.email ?? u.login;
      if (res.channel === "olvid" && res.delivered) {
        feedback.value = t("auth.users.feedbackReSentVia", {
          recipient,
          channel: t("auth.users.channelOlvid"),
        });
      } else if (res.channel === "mail" && res.delivered) {
        feedback.value = t("auth.users.feedbackReSentVia", {
          recipient,
          channel: t("auth.users.channelMail"),
        });
      } else {
        // No live channel or delivery failed — the token is fresh
        // and the URL is cached; the admin can share it manually.
        feedback.value = t("auth.users.feedbackRefreshed");
      }
    } catch {
      feedback.value = t("auth.users.errorResend");
    }
  }

  /**
   * Row-level "Copy link" for any pending user. Silently reissues via
   * resend-invite when we don't have a cached URL yet. Backend won't
   * send mail if the row has no email or SMTP is off — either way we
   * get a fresh URL to copy.
   */
  async function copyInviteLink(u: User) {
    feedback.value = null;
    let url = inviteUrls[u.id];
    if (!url) {
      try {
        const res = await userService.resendInvite(u.id);
        url = res.inviteUrl;
        inviteUrls[u.id] = url;
      } catch {
        feedback.value = t("auth.users.errorGenerateLink");
        return;
      }
    }
    revealedInvite.value = { user: u, inviteUrl: url, mailed: false };
  }

  function askRemove(u: User) {
    pendingDelete.value = u;
  }
  function cancelRemove() {
    pendingDelete.value = null;
  }

  async function confirmRemove() {
    const u = pendingDelete.value;
    if (!u) return;
    pendingDelete.value = null;
    feedback.value = null;
    try {
      await userService.remove(u.id);
      delete inviteUrls[u.id];
      await load();
    } catch (err: unknown) {
      feedback.value = mapAuthError(
        err,
        deleteErrorMap,
        t("auth.users.errorDeleteFallback"),
      );
    }
  }

  return {
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
  };
}
