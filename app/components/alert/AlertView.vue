<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { Source }                from '#shared/types/source'
import { AlertStatus, type AlertModel } from '#shared/types/alert'
import type { BundleModel }     from '#shared/types/bundle'

/*
  Smart container for the view-mode alert page. Owns the state via
  composables and passes data down to leaf views; the leaves are pure
  presentation. Two side-effect modals live here:
    - ConfirmDialog for "delete alert"
    - BundleEditDialog for in-place per-bundle edit (the only WRITE
      affordance in view mode; the alert-level edit flow lives in the
      wizard via `/alerts/[id]?edit=1`).
*/

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
}>(), {
  alertaInicial: null,
})

const { t } = useI18n()
const { alerts, availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts()
const { form, isExisting, isPolling, isWebhook } = useAlertForm(toRef(props, 'alertaInicial'))
const { saving, saveAlert, deleteAlert, setStatus } = useAlertActions()

// ── Derived for header / sections ──────────────────────────────────────────
const canActivate = computed(() => form.value.bundles.length > 0)

// Source name surfaced in the view-mode "Source" row. With the binary
// Source enum, this IS just `form.input`.
const inputTitle = computed(() => {
  if (isPolling.value) return 'Polling Alert'
  if (isWebhook.value) return 'Webhook Alert'
  return form.value.input ? `${form.value.input} Alert` : 'Alert'
})

// Description is truncated to ~100 chars so a long debugging description
// doesn't blow up the head into three lines. Full text lives in the wizard.
const DESCRIPTION_MAX = 100
const truncatedDescription = computed(() => {
  const d = (form.value.description ?? '').trim()
  if (d.length <= DESCRIPTION_MAX) return d
  return d.slice(0, DESCRIPTION_MAX).trimEnd() + '…'
})

const webhookUrl = computed(() => {
  if (!form.value.token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/webhooks/${form.value.token}`
})

// ── Edit / delete / status ─────────────────────────────────────────────────
const confirmingDelete = ref(false)

const openEditAlert = () => {
  if (!form.value.id) return
  navigateTo(`/alerts/${form.value.id}?edit=1`)
}

const onToggleStatus = async () => {
  if (!isExisting.value || !canActivate.value) return
  const next = form.value.status === AlertStatus.Active ? AlertStatus.Inactive : AlertStatus.Active
  try {
    const newStatus = await setStatus(form.value.id as number, next)
    // Optimistic local update. Mutating the alert in-place in the shared
    // alerts ref avoids re-evaluating the page's `alert` computed, which
    // would otherwise cascade through fillFrom and flash the form.
    form.value.status = newStatus
    const idx = alerts.value.findIndex(a => a.id === form.value.id)
    if (idx >= 0 && alerts.value[idx]) alerts.value[idx].status = newStatus
  } catch (error: any) {
    console.error('Error toggling:', error)
  }
}

const onDelete = async () => {
  try {
    await deleteAlert(form.value.id as number)
    confirmingDelete.value = false
    await fetchAlerts()
    navigateTo('/')
  } catch (error: any) {
    console.error('Error deleting:', error)
  }
}

// ── Per-bundle edit modal ──────────────────────────────────────────────────
const editingBundleIndex = ref<number | null>(null)
const editingBundle      = computed<BundleModel | null>(() =>
  editingBundleIndex.value !== null
    ? form.value.bundles[editingBundleIndex.value] ?? null
    : null,
)

const openBundleEditor   = (index: number) => { editingBundleIndex.value = index }
const closeBundleEditor  = () => { editingBundleIndex.value = null }

const onSaveBundle = async ({ index, bundle }: { index: number; bundle: BundleModel }) => {
  if (!form.value.id) return
  // Patch only this bundle on the local form; the payload below carries
  // the user's intended state to the backend.
  const updated = form.value.bundles.map((b, i) => (i === index ? bundle : b))
  const payload = {
    id: form.value.id,
    title: form.value.title,
    description: form.value.description,
    input: form.value.input,
    status: form.value.status,
    alertParams: form.value.alertParams ?? {},
    bundles: updated.map(b => ({
      id: b.id,
      name: b.name,
      formating: b.formating,
      custom_script: b.custom_script,
      discussion_list: b.discussion_list.map(d => d.id),
    })),
  }
  try {
    await saveAlert(payload, { isExisting: true })
    await fetchAlerts()
    closeBundleEditor()
  } catch (error: any) {
    console.error('Error saving bundle:', error)
    alert(`${t('editor.errors.savingBundle')}\n\n${error.data?.message || error.message || t('common.unknownError')}`)
  }
}
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
      @edit="openEditAlert"
      @delete="confirmingDelete = true"
      @update:status="onToggleStatus"
    />

    <div class="panel-body">
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

      <TestPoll
        v-if="isPolling && form.status === AlertStatus.Inactive"
        :alertId="form.id"
      />
    </div>

  </div>
</template>

<style scoped>
.panel-body {
  padding-top: var(--space-4);
}
</style>
