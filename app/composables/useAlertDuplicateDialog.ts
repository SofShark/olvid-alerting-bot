import { ref, watch, type Ref } from "vue";
import type { AlertModel } from "#shared/types/alert";
import { getErrorMessage } from "~/utils/errors";

/**
 * Confirm-and-rename dialog for the "duplicate alert" flow. Owns:
 *   - `open`         — dialog visibility.
 *   - `draftTitle`   — the new alert's title (v-model on the rename input).
 *   - `inputRef`     — template ref so we can focus + select on open.
 *   - `openDialog` / `cancel` / `confirm` — the trio the ConfirmDialog wires.
 *
 * Side effects (save + navigation) are delegated to `duplicateAlert`, so
 * this composable stays UI-flow only. Errors surface as a native
 * alert() with translated copy, matching the previous inline behavior.
 */
export const useAlertDuplicateDialog = (
  form: Ref<AlertModel>,
  duplicateAlert: (newTitle: string) => Promise<unknown>,
) => {
  const { t } = useI18n();

  const open = ref(false);
  const draftTitle = ref("");
  const inputRef = ref<HTMLInputElement | null>(null);

  // Reseed the rename input every time the dialog opens so a previous
  // edit doesn't leak into the next attempt.
  watch(open, (isOpen) => {
    if (!isOpen) return;
    const base = (form.value.title ?? "").trim() || t("common.untitled");
    draftTitle.value = base + t("duplicateModal.copySuffix");
    requestAnimationFrame(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });
  });

  const openDialog = () => {
    open.value = true;
  };
  const cancel = () => {
    open.value = false;
  };
  const confirm = async () => {
    try {
      await duplicateAlert(draftTitle.value);
      open.value = false;
    } catch (error: unknown) {
      console.error("Error duplicating alert:", error);
      alert(
        `${t("editor.errors.duplicating")}\n\n${getErrorMessage(error, t("common.unknownError"))}`,
      );
    }
  };

  return { open, draftTitle, inputRef, openDialog, cancel, confirm };
};
