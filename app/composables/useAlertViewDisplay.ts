import { computed, type ComputedRef, type Ref } from "vue";
import type { AlertModel } from "#shared/types/alert";

/**
 * Pure view-mode derivations off an alert form. No mutations, no side
 * effects — just translated / truncated / composed strings that AlertView
 * used to compute inline. Splitting them out lets AlertView be almost
 * template-only.
 */
export const useAlertViewDisplay = (
  form: Ref<AlertModel>,
  isPolling: ComputedRef<boolean>,
  isMonitoring: ComputedRef<boolean>,
  isWebhook: ComputedRef<boolean>,
) => {
  const { t } = useI18n();

  const inputTitle = computed(() => {
    if (isPolling.value) return t("editor.view.inputTitle.polling");
    if (isMonitoring.value) return t("editor.view.inputTitle.monitoring");
    if (isWebhook.value) return t("editor.view.inputTitle.webhook");
    return form.value.input
      ? t("editor.view.inputTitle.generic", { input: form.value.input })
      : undefined;
  });

  const DESCRIPTION_MAX = 100;
  const truncatedDescription = computed(() => {
    const d = (form.value.description ?? "").trim();
    if (d.length <= DESCRIPTION_MAX) return d;
    return d.slice(0, DESCRIPTION_MAX).trimEnd() + "…";
  });

  const webhookUrl = computed(() => {
    if (!form.value.token) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/webhooks/${form.value.token}`;
  });

  return { inputTitle, truncatedDescription, webhookUrl };
};
