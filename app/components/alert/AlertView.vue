<script setup lang="ts">
import { ref, computed, toRef } from "vue";
import { AlertStatus, type AlertModel } from "#shared/types/alert";
import type { BundleModel } from "#shared/types/bundle";
import { getErrorMessage } from "~/utils/errors";

/*
  Smart container for the view-mode alert page. Owns the state via
  composables and passes data down to leaf views; the leaves are pure
  presentation. Two side-effect modals live here:
    - ConfirmDialog for "delete alert"
    - BundleEditDialog for in-place per-bundle edit (the only WRITE
      affordance in view mode; the alert-level edit flow lives in the
      wizard via `/alerts/[id]?edit=1`).
*/

const props = withDefaults(
  defineProps<{
    alertaInicial?: AlertModel | null;
  }>(),
  {
    alertaInicial: null,
  },
);

const { t } = useI18n();
const { alerts, availableDiscussions, discussionsLoading, fetchAlerts } =
  useAlerts();
const { form, isExisting, isPolling, isMonitoring, isWebhook } = useAlertForm(
  toRef(props, "alertaInicial"),
);
const { saving, saveAlert, deleteAlert, setStatus } = useAlertActions();

// ── Derived for header / sections ──────────────────────────────────────────
const canActivate = computed(() => form.value.bundles.length > 0);

// Source name surfaced in the view-mode "Source" row. With the binary
// Source enum, this IS just `form.input`.
const inputTitle = computed(() => {
  if (isPolling.value) return "Data Polling Alert";
  if (isMonitoring.value) return "Monitoring Alert";
  if (isWebhook.value) return "Webhook Alert";
  return form.value.input ? `${form.value.input} Alert` : "Alert";
});

// Description is truncated to ~100 chars so a long debugging description
// doesn't blow up the head into three lines. Full text lives in the wizard.
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

// ── Edit / delete / status / duplicate ────────────────────────────────────
const confirmingDelete = ref(false);
const confirmingDuplicate = ref(false);

// ── Test now (overflow menu → server-side dry-run) ────────────────────────
// First run shows an explainer dialog; user can tick "don't show again"
// which stores a bare flag in localStorage. Subsequent runs skip straight
// to the result modal owned by AlertTestRunner.
//
// This container knows nothing about polling vs monitoring — that
// decision lives in `alertTester` on the server. Locally we only ask
// "is this a source we can test at all?" via `canTest`.
const TEST_INTRO_SKIP_KEY = "alerting.dontShowAgain.alertTestIntro";
const showingTestIntro = ref(false);
const testRunnerRef = ref<{ run: () => Promise<void> } | null>(null);

const canTest = computed(
  () => !!form.value.id && (isPolling.value || isMonitoring.value),
);

const testIntroSuppressed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TEST_INTRO_SKIP_KEY) === "1";
  } catch {
    // Private mode / storage disabled — always show the intro.
    return false;
  }
};

const onTest = () => {
  if (!canTest.value) return;
  if (testIntroSuppressed()) {
    testRunnerRef.value?.run();
  } else {
    showingTestIntro.value = true;
  }
};

const onTestIntroConfirm = (dontShowAgain: boolean) => {
  showingTestIntro.value = false;
  if (dontShowAgain && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TEST_INTRO_SKIP_KEY, "1");
    } catch {
      // Best effort — if storage is unavailable the user just sees the
      // intro again next time. Not worth surfacing an error.
    }
  }
  testRunnerRef.value?.run();
};

const openEditAlert = () => {
  if (!form.value.id) return;
  navigateTo(`/alerts/${form.value.id}?edit=1`);
};

/**
 * POST /api/backend with a fresh copy of the current alert. We strip any
 * per-row identity (`id`, `token`, bundle ids) so Prisma generates fresh
 * ones, force the copy to `Inactive` regardless of the source status,
 * and drop the runtime-state keys from alertParams (`_lastFired`,
 * `_lastPolledAt`, `_lastHash`, `_baseline`, `_lastStatus`) so the copy
 * starts with a clean engine state instead of inheriting the original's
 * poll history.
 */
const cleanAlertParamsForCopy = (params: any): any => {
  if (!params || typeof params !== "object") return params ?? {};
  const RUNTIME_KEYS = new Set([
    "_lastFired",
    "_lastPolledAt",
    "_lastHash",
    "_baseline",
    "_lastStatus",
  ]);
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!RUNTIME_KEYS.has(k)) cleaned[k] = v;
  }
  return cleaned;
};

const onDuplicate = async (newTitle: string) => {
  if (!form.value.id) return;
  const payload = {
    id: null,
    token: null,
    title: newTitle,
    description: form.value.description ?? "",
    input: form.value.input,
    status: AlertStatus.Inactive,
    alertParams: cleanAlertParamsForCopy(form.value.alertParams),
    bundles: form.value.bundles.map((b) => ({
      // No `id` — the DB assigns a fresh one for each cloned bundle.
      name: b.name,
      formating: b.formating,
      custom_script: b.custom_script,
      discussion_list: b.discussion_list.map((d) => d.id),
    })),
  };
  try {
    const saved = await saveAlert(payload, { isExisting: false });
    confirmingDuplicate.value = false;
    await fetchAlerts();
    if (saved?.id) navigateTo(`/alerts/${saved.id}`);
  } catch (error: any) {
    console.error("Error duplicating alert:", error);
    alert(
      `${t("editor.errors.duplicating")}\n\n${getErrorMessage(error, t("common.unknownError"))}`,
    );
  }
};

const onToggleStatus = async () => {
  if (!isExisting.value || !canActivate.value) return;
  const next =
    form.value.status === AlertStatus.Active
      ? AlertStatus.Inactive
      : AlertStatus.Active;
    try {
      const newStatus = await setStatus(form.value.id as number, next);
      // Optimistic local update. Mutating the alert in-place in the shared
      // alerts ref avoids re-evaluating the page's `alert` computed, which
      // would otherwise cascade through fillFrom and flash the form.
      form.value.status = newStatus;
      const idx = alerts.value.findIndex((a) => a.id === form.value.id);
      if (idx >= 0 && alerts.value[idx]) alerts.value[idx].status = newStatus;
    } catch (error: any) {
      console.error("Error toggling:", error);
  }
};

const onDelete = async () => {
  try {
    await deleteAlert(form.value.id as number);
    confirmingDelete.value = false;
    await fetchAlerts();
    navigateTo("/");
  } catch (error: any) {
    console.error("Error deleting:", error);
  }
};

// ── Per-bundle edit modal ──────────────────────────────────────────────────
const editingBundleIndex = ref<number | null>(null);
const editingBundle = computed<BundleModel | null>(() =>
  editingBundleIndex.value !== null
    ? (form.value.bundles[editingBundleIndex.value] ?? null)
    : null,
);

const openBundleEditor = (index: number) => {
  editingBundleIndex.value = index;
};
const closeBundleEditor = () => {
  editingBundleIndex.value = null;
};

const onSaveBundle = async ({
  index,
  bundle,
}: {
  index: number | null;
  bundle: BundleModel;
}) => {
  // View mode only edits existing bundles — create (index null) is a
  // wizard-only flow and can't be reached from here.
  if (index === null || !form.value.id) return;
  // Patch only this bundle on the local form; the payload below carries
  // the user's intended state to the backend.
  const updated = form.value.bundles.map((b, i) => (i === index ? bundle : b));
  const payload = {
    id: form.value.id,
    title: form.value.title,
    description: form.value.description,
    input: form.value.input,
    status: form.value.status,
    alertParams: form.value.alertParams ?? {},
    bundles: updated.map((b) => ({
      id: b.id,
      name: b.name,
      formating: b.formating,
      custom_script: b.custom_script,
      discussion_list: b.discussion_list.map((d) => d.id),
    })),
  };
  try {
    await saveAlert(payload, { isExisting: true });
    await fetchAlerts();
    closeBundleEditor();
  } catch (error: any) {
    console.error("Error saving bundle:", error);
    alert(
      `${t("editor.errors.savingBundle")}\n\n${getErrorMessage(error, t("common.unknownError"))}`,
    );
  }
};
</script>

<template>
  
      <div class="panel editor">
        <ConfirmDialog
          :open="confirmingDelete"
          :title="$t('wizard.deleteModal.title')"
          :message="$t('wizard.deleteModal.message')"
          :confirm-label="$t('button.delete')"
          :cancel-label="$t('button.cancel')"
          variant="danger"
          @confirm="onDelete"
          @cancel="confirmingDelete = false"
        />

        <DuplicateAlertDialog
          :open="confirmingDuplicate"
          :original-title="form.title"
          :saving="saving"
          @confirm="onDuplicate"
          @cancel="confirmingDuplicate = false"
        />

        <BundleEditDialog
          :open="editingBundleIndex !== null"
          :bundle="editingBundle"
          :index="editingBundleIndex"
          :alert-context="form"
          :alert-params="form.alertParams"
          :input-source="form.input"
          :available-discussions="availableDiscussions"
          :discussions-loading="discussionsLoading"
          :saving="saving"
          @save="onSaveBundle"
          @cancel="closeBundleEditor"
        />
        

        <AlertViewHeader
          :title="form.title"
          :description="truncatedDescription"
          :input-title="inputTitle"
          :bundle-count="form.bundles.length"
          :status="form.status"
          :is-existing="isExisting"
          :can-activate="canActivate"
          :can-test="canTest"
          @edit="openEditAlert"
          @test="onTest"
          @duplicate="confirmingDuplicate = true"
          @delete="confirmingDelete = true"
          @update:status="onToggleStatus"
        />

        <!-- One-time explainer + headless test runner driven imperatively
             by the overflow menu. The runner owns the result modal; we
             only call its `run()`. Source-agnostic — the server picks
             polling vs monitoring behind the unified endpoint. -->
        <AlertTestIntroDialog
          :open="showingTestIntro"
          @confirm="onTestIntroConfirm"
          @cancel="showingTestIntro = false"
        />
        <AlertTestRunner
          v-if="canTest"
          ref="testRunnerRef"
          :alert-id="form.id"
        />
        
          <div class="panel-body">
            <div class="split">
              <div class="split-left">
              <AlertInputSummary
                :input-title="inputTitle"
                :source="form.input"
                :alert-params="form.alertParams"
                :webhook-url="webhookUrl"
              />

              <AlertBundleTable
                :bundles="form.bundles"
                @edit-bundle="openBundleEditor"
              />

              <!-- "Test now" is driven by AlertActionsMenu; the headless
                   AlertTestRunner is mounted at the top of this component
                   and dispatches polling vs monitoring server-side. -->
            </div>
            <div class="split-right">
              <AlertLogs :alert-id="form.id" />
            </div>
          </div>

        </div>
        
      </div>
   
</template>

<style scoped>
.panel-body {
  padding-top: var(--space-4);
}

.split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0;
  height: 100%;
  --sidebar-w: 200px;
  transition: grid-template-columns 0.18s ease;
}

.split-left,
.split-right {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.split-right{
  padding-left: 10px;
}

</style>
