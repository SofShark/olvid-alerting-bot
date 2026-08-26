import type { Ref } from "vue";
import type { AlertModel } from "#shared/types/alert";

/**
 * Wizard's back-to-list + discard flow.
 *
 *   - onBackToList           :  opens the discard prompt when the form is dirty,
 *                              otherwise leaves for `/`.
 *   - `onDiscard`             : user picked "discard changes".
 *   - `onSaveDraftAndLeave`   : DiscardChangesDialog's secondary action
 *                              when the alert is incomplete: save as
 *                              draft, then leave.
 *   - `onSaveAlertAndLeave`   : dialog's primary action when the alert is
 *                              complete: save runnably, then leave.
 *
 * All four converge on `finishLeave(defaultTarget)` — clearing the
 * pending-leave latch and letting the route guard fire once. Pull the
 * `save` fn from `useWizardSave` and the dirty-guard bits from
 * `useDirtyGuard`; this composable only owns the leave-orchestration.
 */
export const useWizardLeave = (opts: {
  form: Ref<AlertModel>;
  save: (forceDraft: boolean, navigateAfter: boolean) => Promise<void>;
  isDirty: Ref<boolean>;
  showDiscardPrompt: Ref<boolean>;
  pendingLeave: Ref<string | null>;
  allowNextLeave: () => void;
}) => {
  const finishLeave = (defaultTarget: string) => {
    opts.showDiscardPrompt.value = false;
    const target = opts.pendingLeave.value;
    opts.pendingLeave.value = null;
    opts.allowNextLeave();
    return navigateTo(target ?? defaultTarget);
  };

  const onBackToList = () => {
    if (opts.isDirty.value) {
      opts.showDiscardPrompt.value = true;
    } else {
      navigateTo("/");
    }
  };

  const onDiscard = () => finishLeave("/");

  const onSaveDraftAndLeave = async () => {
    await opts.save(true, false);
    if (!opts.form.value.id) return; // save failed — keep the prompt up
    await finishLeave("/alerts/" + opts.form.value.id);
  };

  // Discard prompt's primary action when the alert is complete: save it
  // runnably (goes through the normal auto-status policy) and leave.
  const onSaveAlertAndLeave = async () => {
    await opts.save(false, false);
    if (!opts.form.value.id) return;
    await finishLeave("/alerts/" + opts.form.value.id);
  };

  return {
    onBackToList,
    onDiscard,
    onSaveDraftAndLeave,
    onSaveAlertAndLeave,
  };
};
