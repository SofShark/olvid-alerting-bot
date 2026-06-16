<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onBeforeRouteLeave, type RouteLocationNormalized } from 'vue-router'
import { Formatting, AlertStatus, Trigger, type DiscussionModel, type BundleModel, type AlertModel } from '#shared/constants'
import { alertService } from '~/utils/alertService'

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
}>(), {
  alertaInicial: null,
})

// State and navigation come from the composable + Nuxt router.
const { availableDiscussions, discussionsLoading, fetchAlerts } = useAlerts()

// ── Internal mode ────────────────────────────────────────────
const editing = ref(false)           // false = view mode, true = edit mode
const formSnapshot = ref('')         // JSON snapshot taken when entering edit mode
const showDiscardWarning = ref(false)
const confirmingDelete = ref(false)
const saving = ref(false)

// Route guard plumbing — see AlertWizard for the full rationale.
const pendingLeave = ref<RouteLocationNormalized | null>(null)
// One-shot escape hatch: set to true right before a navigation that the
// guard should let through (confirmed discard, save, delete). The guard
// reads-and-resets it so it can't suppress a later leave by accident.
const bypassGuard = ref(false)

onBeforeRouteLeave((to) => {
  if (bypassGuard.value) { bypassGuard.value = false; return true }
  if (!isDirty.value) return true
  pendingLeave.value = to
  showDiscardWarning.value = true
  return false
})

// Browser-level: tab close, hard refresh, address bar nav. preventDefault is
// the modern trigger for the "Leave site?" confirmation; returnValue is
// deprecated and no longer needed.
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (isDirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const blankForm = (): AlertModel => ({
  id: null,
  title: '',
  description: '',
  input: '',
  triggerType: '',
  status: AlertStatus.Draft,
  token: '',
  triggerParams: {},
  bundles: []
})

const form = ref<AlertModel>(blankForm())

// Resolve discussion ids to full {id,title} objects for display.
const resolveDiscussions = (ids: any[]): DiscussionModel[] =>
  (ids || []).map((entry: any) => {
    const id = String(typeof entry === 'object' ? entry.id : entry)
    const discussions = availableDiscussions?.value ?? []
    return discussions.find(d => d.id === id) ?? { id, title: `#${id}` }
  })

const fillFrom = (a: AlertModel | null) => {
  if (a && a.id) {
    form.value = {
      id: a.id,
      title: a.title || '',
      description: a.description || '',
      input: a.input || '',
      triggerType: a.triggerType || '',
      status: a.status || AlertStatus.Draft,
      token: a.token || '',
      triggerParams: (a.triggerParams as Record<string, any>) ?? {},
      bundles: (a.bundles || []).map(b => ({
        id: b.id,
        name: b.name,
        formating: (b.formating as Formatting) || Formatting.Unformatted,
        custom_script: b.custom_script || '',
        discussion_list: resolveDiscussions(b.discussion_list as any)
      }))
    }
  } else {
    form.value = blankForm()
  }
}

// When selection changes: new → edit mode, existing → view mode.
watch(() => props.alertaInicial, (a) => {
  fillFrom(a)
  editing.value = !a || !a.id
  showDiscardWarning.value = false
  confirmingDelete.value = false
}, { immediate: true })

// Re-resolve discussion titles once available discussions finish loading.

watch(availableDiscussions, (available) => {
  if (available.length === 0) return
  form.value.bundles = form.value.bundles.map(b => ({
    ...b,
    discussion_list: resolveDiscussions(b.discussion_list)
  }))
})

// ── Derived state ────────────────────────────────────────────
const isExisting = computed(() => form.value.id !== null)
const canActivate = computed(() => form.value.bundles.length > 0)

const saveLabel = computed(() => {
  if (isExisting.value) return 'Save Changes'
  return form.value.input ? 'Save Alert' : 'Save Draft'
})

const webhookUrl = computed(() => {
  if (!form.value.token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api/webhooks/${form.value.token}`
})

const statusLabel = computed(() => {
  if (form.value.status === AlertStatus.Active) return 'Active'
  if (form.value.status === AlertStatus.Inactive) return 'Inactive'
  return 'Draft'
})

// ── Edit mode management ─────────────────────────────────────
const startEditing = () => {
  // Save pre-edition values of the form
  formSnapshot.value = JSON.stringify(form.value)
  editing.value = true
}

// Detect if modifications have been made when selected "edit alert"
const isDirty = computed(() => {
  if (!editing.value) return false
  return JSON.stringify(form.value) !== formSnapshot.value
})

// "Back" button in edit mode — warn if dirty.
const requestBack = () => {
  if (isDirty.value) {
    showDiscardWarning.value = true
  } else {
    cancelEdit()
  }
}

const cancelEdit = () => {
  showDiscardWarning.value = false
  const target = pendingLeave.value
  pendingLeave.value = null

  // Always restore the form from props so isDirty falls to false — that lets
  // both the pending nav (sidebar) and a future user action through cleanly.
  if (isExisting.value) {
    fillFrom(props.alertaInicial)
    editing.value = false
  }

  if (target) {
    // The discard was triggered by the route guard (sidebar / address bar).
    // Skip the guard for this one navigation and continue to where the user
    // was actually trying to go.
    bypassGuard.value = true
    navigateTo(target)
  } else if (!isExisting.value) {
    // "Back" pressed on a never-saved new alert — fall back to the list.
    bypassGuard.value = true
    navigateTo('/')
  }
  // Existing alert + no pending target: just stay here in view mode.
}

const dismissDiscard = () => {
  showDiscardWarning.value = false
  pendingLeave.value = null
}

// Modal "Save Changes": persist, then continue to wherever the user was
// actually trying to go (sidebar target), or fall back to view mode in place.
const saveAndLeave = async () => {
  await save()
  if (saving.value) return // mid-flight — shouldn't happen because save awaits, defensive only
  showDiscardWarning.value = false
  const target = pendingLeave.value
  pendingLeave.value = null
  if (target) {
    bypassGuard.value = true
    navigateTo(target)
  } else {
    // No pending target: drop back to view mode in place. The form was
    // updated server-side; the props watcher will re-sync once fetchAlerts
    // finishes.
    editing.value = false
  }
}

// ── Input source change ──────────────────────────────────────
const onInputChange = () => {
  // TriggerSelector handles clearing triggerType via its own watch.
}

// ── Bundles ──────────────────────────────────────────────────
const addBundle = () => {
  form.value.bundles.push({
    discussion_list: [],
    formating: Formatting.Unformatted,
    custom_script: ''
  })
}
const updateBundle = (index: number, newBundle: BundleModel) => {
  form.value.bundles[index] = newBundle
}
const removeBundle = (index: number) => {
  form.value.bundles.splice(index, 1)
}

// ── Persistence ──────────────────────────────────────────────
const buildPayload = () => ({
  id: form.value.id,
  title: form.value.title,
  description: form.value.description,
  input: form.value.input,
  triggerType: form.value.triggerType,
  status: form.value.status,
  triggerParams: form.value.triggerParams ?? {},
  bundles: form.value.bundles.map(b => ({
    id: b.id,
    name: b.name,
    formating: b.formating,
    custom_script: b.custom_script,
    discussion_list: b.discussion_list.map(d => d.id)
  }))
})

const save = async () => {
  if (!form.value.title) return alert('Title is mandatory')
  saving.value = true
  try {
    const payload = buildPayload()
    if (isExisting.value) {
      await alertService.updateAlert(payload)
      await fetchAlerts()
      // Stay on this route; the watcher on alertaInicial will refresh the form.
    } else {
      const res: any = await alertService.saveAlert(payload)
      const newId = res?.data?.id
      await fetchAlerts()
      // Alert is now persisted; isDirty is technically still true because the
      // snapshot is stale, so we bypass the guard for this nav.
      bypassGuard.value = true
      await navigateTo('/alerts/' + newId)
    }
  } catch (error: any) {
    console.error('Error saving:', error.data || error)
    alert(`Error saving alert:\n\n${error.data?.message || error.message || 'Unknown error'}`)
  } finally {
    saving.value = false
  }
}

// Toggle status (works in view mode — doesn't leave the page).
const toggleStatus = async () => {
  if (!isExisting.value || !canActivate.value) return
  const next = form.value.status === AlertStatus.Active ? AlertStatus.Inactive : AlertStatus.Active
  try {
    const res: any = await alertService.setStatus(form.value.id as number, next)
    if (res?.data?.status) form.value.status = res.data.status
    await fetchAlerts() // refresh sidebar count / status dots
  } catch (error: any) {
    console.error('Error toggling:', error)
  }
}

const doDelete = async () => {
  try {
    await alertService.delete(form.value.id as number)
    confirmingDelete.value = false
    await fetchAlerts()
    // The alert is gone — no dirty state to warn about, but isDirty's snapshot
    // is irrelevant now. Bypass to be safe.
    bypassGuard.value = true
    navigateTo('/')
  } catch (error: any) {
    console.error('Error deleting:', error)
  }
}

const copyWebhook = () => {
  if (webhookUrl.value) navigator.clipboard?.writeText(webhookUrl.value)
}

// ── Manual test poll (polling alerts, inactive only) ────────────────────────
const testing    = ref(false)
const testResult = ref<any>(null)

const runTestPoll = async () => {
  if (!form.value.id) return
  testing.value = true
  try {
    testResult.value = await $fetch('/api/poll/test', {
      method: 'POST',
      body: { alertId: form.value.id },
    })
  } catch (error: any) {
    testResult.value = { ok: false, error: error?.data?.statusMessage ?? error?.message ?? 'Test failed' }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="panel editor">

    <!-- ── Overlays ─────────────────────────────────────────── -->
    <div v-if="showDiscardWarning" class="overlay">
      <div class="overlay-box">
        <h4>Unsaved changes</h4>
        <p>You have unsaved changes. If you leave now, they will be lost.</p>
        <div class="overlay-actions">
          <button
            v-if="form.title"
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            @click="saveAndLeave"
          >
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
          <button type="button" class="btn btn-ghost" @click="dismissDiscard">Continue editing</button>
          <button type="button" class="btn btn-danger" @click="cancelEdit">Discard changes</button>
        </div>
      </div>
    </div>

    <div v-if="confirmingDelete" class="overlay">
      <div class="overlay-box">
        <h4>Delete this alert?</h4>
        <p>This removes the alert and all its bundles. This cannot be undone.</p>
        <div class="overlay-actions">
          <button type="button" class="btn btn-ghost" @click="confirmingDelete = false">Cancel</button>
          <button type="button" class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ VIEW MODE ═══════════════════════ -->
    <template v-if="!editing">

      <!-- Header (view) -->
      <div class="panel-head">
        <div class="head-left">
          <span class="head-tag">#{{ form.id }}</span>
          <h2 class="view-title">{{ form.title || 'Untitled' }}</h2>
        </div>
        <div class="head-right">
          <div v-if="isExisting" class="toggle-wrap" :title="canActivate ? '' :
                (form.status == AlertStatus.Draft ? 'Complete necessary fields and add a bundle to activate' : 'Add a bundle to activate')">
            <button
              type="button" class="toggle" :class="{ on: form.status === AlertStatus.Active }"
              :disabled="!canActivate" @click="toggleStatus"
            ><span class="knob"></span></button>
            <span class="toggle-label">{{ statusLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Body (view) — same field layout as edit mode, controls disabled. -->
      <div class="panel-body">

        <div class="field">
          <label class="field-label">Description</label>
          <textarea
            :value="form.description || '— no description —'"
            rows="2"
            class="field-input"
            disabled
          />
        </div>

        <div v-if="form.input" class="field">
          <label class="field-label">Input Source</label>
          <span class="detail-badge">
            {{ form.input }}
            <span v-if="form.triggerType" class="trigger-inline">via {{ form.triggerType }}</span>
          </span>
        </div>

        <!-- Webhook URL — only shown when trigger is specifically Webhook -->
        <div v-if="form.triggerType === Trigger.Webhook && webhookUrl && form.input != ''" class="field">
          <label class="field-label">Webhook Endpoint</label>
          <div class="webhook-box">
            <code>{{ webhookUrl }}</code>
            <button type="button" class="btn-copy" @click="copyWebhook">📋</button>
          </div>
        </div>

        <!-- Test poll — polling alerts only, while inactive -->
        <div
          v-if="form.triggerType === Trigger.Polling && form.status === AlertStatus.Inactive"
          class="test-panel"
        >
          <div class="divider"><span>Test polling</span></div>
          <p class="test-intro">
            Trigger the polling pipeline once manually. The alert won't be
            activated and no bundles will be fired — this just shows what would
            happen on the next scheduled poll.
          </p>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="testing"
            @click="runTestPoll"
          >
            {{ testing ? 'Polling…' : 'Run test poll' }}
          </button>

          <div v-if="testResult" class="test-result">
            <div v-if="testResult.error" class="test-error">
              ⚠ {{ testResult.error }}
            </div>
            <template v-else>
              <div
                class="test-verdict"
                :class="testResult.condition?.fired ? 'fired' : 'not-fired'"
              >
                <span class="bullet">●</span>
                <span v-if="testResult.condition?.fired">
                  Condition met — alert would fire.
                </span>
                <span v-else>
                  Condition not met — alert would not fire.
                </span>
              </div>
              <p class="test-reason">{{ testResult.condition?.reason }}</p>

              <div
                v-if="testResult.condition?.observedValue !== undefined"
                class="test-value-block"
              >
                <span class="test-value-label">Observed value</span>
                <pre class="test-value">{{ JSON.stringify(testResult.condition.observedValue, null, 2) }}</pre>
              </div>

              <details class="test-raw">
                <summary>Parsed document</summary>
                <pre>{{ JSON.stringify(testResult.parsed, null, 2) }}</pre>
              </details>
            </template>
          </div>
        </div>

        <!-- Bundles — full BundleCard in readonly mode so view + edit share
             exactly the same visual structure. -->
        <div class="divider"><span>Bundles ({{ form.bundles.length }})</span></div>

        <div v-if="form.bundles.length === 0" class="bundles-hint">
          No bundles configured. Click <strong>Edit Alert</strong> to add one.
        </div>

        <div class="bundles-grid">
          <BundleCard
            v-for="(b, i) in form.bundles"
            :key="i"
            :bundle="b"
            :index="i"
            :available-discussions="availableDiscussions"
            :discussions-loading="discussionsLoading"
            :input-source="form.input"
            :alert-context="form"
            :trigger-params="form.triggerParams"
            readonly
          />
        </div>

      </div>

      <!-- Footer (view) -->
      <div class="panel-foot">
        <button type="button" class="btn btn-danger-ghost" @click="confirmingDelete = true">Delete</button>
        <div class="foot-spacer"></div>
        <ButtonPrimary @click="startEditing">Edit Alert </ButtonPrimary>
       </div>

    </template>

    <!-- ═══════════════════ EDIT MODE ═══════════════════════ -->
    <template v-else>

      <!-- Header (edit) -->
      <div class="panel-head">
        <div class="head-left">
          <span class="head-tag" >{{ form.id ? `#${form.id}` : 'NEW' }}</span>
          <input v-model="form.title" type="text" placeholder="Alert title…" class="title-input" />
        </div>
        <div class="head-right">
          <button type="button" class="btn btn-ghost" @click="requestBack">← Back</button>
        </div>
      </div>

      <!-- Body (edit) -->
      <div class="panel-body">
        <div class="field">
          <label class="field-label">Description</label>
          <textarea v-model="form.description" rows="2" placeholder="What does this alert do?" class="field-input"></textarea>
        </div>

        <div class="field">
          <label class="field-label">Input Source <span class="field-required">*</span></label>
          <InputSourceSelector v-model="form.input" :locked="form.bundles.length > 0" @update:modelValue="onInputChange" />
        </div>

        <div v-if="form.input" class="field">
          <label class="field-label">Trigger</label>
          <TriggerSelector v-model="form.triggerType" :source="form.input" />
        </div>

        <!-- Polling / Olvid params (when trigger requires configuration) -->
        <div v-if="form.input && form.triggerType && form.triggerType !== 'Webhook'" class="field">
          <label class="field-label">Trigger configuration</label>
          <TriggerParamsEditor
            :source="form.input"
            :trigger-type="form.triggerType"
            :model-value="form.triggerParams ?? {}"
            @update:model-value="form.triggerParams = $event"
          />
        </div>

        <!-- Bundles (once input + trigger set) -->
        <template v-if="form.input && form.triggerType">
          <div class="divider"><span>Bundles</span></div>

          <p v-if="form.bundles.length === 0" class="bundles-hint">
            No bundles yet. Add at least one to be able to activate this alert.
          </p>

          <div class="bundles-grid">
            <BundleCard
              v-for="(b, i) in form.bundles"
              :key="i"
              :bundle="b"
              :index="i"
              :available-discussions="availableDiscussions"
              :discussions-loading="discussionsLoading"
              :input-source="form.input"
              @update:bundle="updateBundle(i, $event)"
              @remove="removeBundle(i)"
            />

            <button type="button" class="card-add" @click="addBundle">
              <span class="plus">+</span>
              <span>New Bundle</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Footer (edit) -->
      <div class="panel-foot">
        <div class="foot-spacer"></div>
        <ButtonPrimary :disabled="!form.title || saving" @click="save" >
          {{ saving ? 'Saving…' : saveLabel }}
        </ButtonPrimary>
      </div>

    </template>

  </div>
</template>

<style scoped>
/* Surfaces (.panel / .panel-head / .panel-body / .panel-foot / .field* /
 * .btn* / .overlay* / .card-add) come from the global stylesheet. Only
 * editor-specific patterns live here: the active/inactive toggle, view-mode
 * detail rows, bundle summary cards, the webhook box, the test-poll panel,
 * and the divider.
 */

/* Header composition — same recipe as the wizard. */
.head-left  { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; }
.head-right { display: flex; align-items: center; gap: var(--space-5); flex-shrink: 0; }
.head-tag {
  background: var(--color-border-subtle);
  color: var(--color-text-dim);
  font-size: var(--text-md);
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.title-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: 600;
  padding: var(--space-1) 2px;
}
.title-input:focus { outline: none; border-bottom-color: var(--color-accent); }
.title-input::placeholder { color: var(--color-text-faint); }

.view-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Active/inactive toggle ─────────────────────── */
.toggle-wrap { display: flex; align-items: center; gap: var(--space-3); }
.toggle {
  width: 42px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border-default);
  border: none;
  position: relative;
  cursor: pointer;
  transition: background-color .2s;
  padding: 0;
}
.toggle.on { background: var(--color-accent); }
.toggle:disabled { opacity: .4; cursor: not-allowed; }
.knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--color-text-on-accent);
  transition: transform .2s;
}
.toggle.on .knob { transform: translateX(20px); }
.toggle-label {
  font-size: var(--text-md);
  color: var(--color-text-muted);
  font-weight: 600;
  min-width: 54px;
}

/* ── View-mode "Input Source" badge ─────────────── */
.detail-badge {
  display: inline-flex;
  align-items: center;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-base);
  font-weight: 500;
  padding: 5px var(--space-4);
  border-radius: var(--radius-md);
  width: fit-content;
}
.trigger-inline {
  color: var(--color-text-dim);
  font-size: var(--text-sm);
  font-weight: 400;
  margin-left: var(--space-2);
}

/* ── Webhook box ────────────────────────────────── */
.webhook-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-bg-code);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.webhook-box code {
  color: var(--color-text-webhook);
  font-size: var(--text-md);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.btn-copy { background: transparent; border: none; cursor: pointer; font-size: var(--text-lg); }

/* ── Test poll panel ────────────────────────────── */
.test-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.test-intro { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); line-height: 1.5; }

.test-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}
.test-error { color: var(--color-danger-bright); font-size: var(--text-md); font-family: var(--font-mono); }
.test-verdict {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-base);
  font-weight: 600;
}
.test-verdict .bullet { font-size: var(--text-lg); }
.test-verdict.fired              { color: var(--color-success-text); }
.test-verdict.fired     .bullet  { color: var(--color-success); }
.test-verdict.not-fired          { color: var(--color-text-secondary); }
.test-verdict.not-fired .bullet  { color: var(--color-text-dim); }
.test-reason { margin: 0; color: var(--color-text-muted); font-size: var(--text-md); }

.test-value-block { display: flex; flex-direction: column; gap: var(--space-1); }
.test-value-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.test-value {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-code);
  border-radius: var(--radius-sm);
  color: var(--color-text-code);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  max-height: 160px;
  overflow-y: auto;
}

.test-raw { color: var(--color-text-dim); font-size: var(--text-md); }
.test-raw summary { cursor: pointer; user-select: none; padding: 2px 0; }
.test-raw summary:hover { color: var(--color-accent-text); }
.test-raw pre {
  margin: var(--space-2) 0 0;
  padding: var(--space-4);
  background: var(--color-bg-code);
  border-radius: var(--radius-sm);
  color: var(--color-text-code);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  max-height: 240px;
  overflow: auto;
}

/* ── Divider ────────────────────────────────────── */
.divider { display: flex; align-items: center; gap: var(--space-3); margin: 2px 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border-subtle); }
.divider span {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.bundles-hint { color: var(--color-text-dim); font-size: var(--text-md); font-style: italic; margin: 0; }

.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
}

.foot-spacer { flex: 1; }
</style>
