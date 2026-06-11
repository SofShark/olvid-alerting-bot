<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BundleCard from './BundleCard.vue'
import { Formatting, AlertStatus, Trigger, type DiscussionModel, type BundleModel, type AlertModel } from '#shared/constants'

const props = withDefaults(defineProps<{
  alertaInicial?: AlertModel | null
  availableDiscussions?: DiscussionModel[]
  discussionsLoading?: boolean
}>(), {
  alertaInicial: null,
  availableDiscussions: () => [],
  discussionsLoading: false
})

const emit = defineEmits(['saved', 'updated', 'deleted', 'close'])

// ── Internal mode ────────────────────────────────────────────
const editing = ref(false)           // false = view mode, true = edit mode
const formSnapshot = ref('')         // JSON snapshot taken when entering edit mode
const showDiscardWarning = ref(false)
const confirmingDelete = ref(false)
const saving = ref(false)

const blankForm = (): AlertModel => ({
  id: null,
  title: '',
  description: '',
  input: '',
  triggerType: '',
  status: AlertStatus.Draft,
  token: '',
  bundles: []
})

const form = ref<AlertModel>(blankForm())

// Resolve discussion ids to full {id,title} objects for display.
const resolveDiscussions = (ids: any[]): DiscussionModel[] =>
  (ids || []).map((entry: any) => {
    const id = String(typeof entry === 'object' ? entry.id : entry)
    return props.availableDiscussions.find(d => d.id === id) ?? { id, title: `#${id}` }
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
watch(() => props.availableDiscussions, (available) => {
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
  formSnapshot.value = JSON.stringify(form.value)
  editing.value = true
}

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
  if (isExisting.value) {
    // Restore from props and go back to view mode.
    fillFrom(props.alertaInicial)
    editing.value = false
  } else {
    // New alert with nothing saved — close entirely.
    emit('close')
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
    isExisting.value
      ? await alertService.updateAlert(payload)
      : await alertService.saveAlert(payload)
    emit('saved')
  } catch (error: any) {
    console.error('Error saving:', error.data || error)
    alert(`Error saving alert:\n\n${error.data?.message || error.message || 'Unknown error'}`)
  } finally {
    saving.value = false
  }
}

// Toggle status (works in view mode — doesn't close the panel).
const toggleStatus = async () => {
  if (!isExisting.value || !canActivate.value) return
  const next = form.value.status === AlertStatus.Active ? AlertStatus.Inactive : AlertStatus.Active
  try {
    const res: any = await alertService.setStatus(form.value.id as number, next)
    if (res?.data?.status) form.value.status = res.data.status
    emit('updated') // refresh sidebar, keep panel open
  } catch (error: any) {
    console.error('Error toggling:', error)
  }
}

const doDelete = async () => {
  try {
    await alertService.delete(form.value.id as number)
    confirmingDelete.value = false
    emit('deleted')
  } catch (error: any) {
    console.error('Error deleting:', error)
  }
}

const copyWebhook = () => {
  if (webhookUrl.value) navigator.clipboard?.writeText(webhookUrl.value)
}
</script>

<template>
  <div class="editor">

    <!-- ── Overlays ─────────────────────────────────────────── -->
    <div v-if="showDiscardWarning" class="confirm-overlay">
      <div class="confirm-box">
        <h4>Unsaved changes</h4>
        <p>You have unsaved changes. If you go back now, they will be lost.</p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="showDiscardWarning = false">Continue editing</button>
          <button type="button" class="btn-danger" @click="cancelEdit">Discard changes</button>
        </div>
      </div>
    </div>

    <div v-if="confirmingDelete" class="confirm-overlay">
      <div class="confirm-box">
        <h4>Delete this alert?</h4>
        <p>This removes the alert and all its bundles. This cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="confirmingDelete = false">Cancel</button>
          <button type="button" class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ VIEW MODE ═══════════════════════ -->
    <template v-if="!editing">

      <!-- Header (view) -->
      <div class="editor-head">
        <div class="head-left">
          <span class="head-tag">#{{ form.id }}</span>
          <h2 class="view-title">{{ form.title || 'Untitled' }}</h2>
        </div>
        <div class="head-right">
          <div v-if="isExisting" class="toggle-wrap" :title="canActivate ? '' : 'Add a bundle to activate'">
            <button
              type="button" class="toggle" :class="{ on: form.status === AlertStatus.Active }"
              :disabled="!canActivate" @click="toggleStatus"
            ><span class="knob"></span></button>
            <span class="toggle-label">{{ statusLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Body (view) -->
      <div class="editor-body">

        <div v-if="form.description" class="detail-row">
          <span class="detail-label">Description</span>
          <p class="detail-text">{{ form.description }}</p>
        </div>

        <div class="detail-cols">
          <div v-if="form.input" class="detail-row">
            <span class="detail-label">Input Source</span>
            <span class="detail-badge">{{ form.input }}</span>
          </div>
          <div v-if="form.triggerType && form.input" class="detail-row">
            <span class="detail-label">Trigger</span>
            <span class="detail-badge">{{ form.triggerType }}</span>
          </div>
        </div>

        <!-- Webhook URL — only shown when trigger is specifically Webhook -->
        <div v-if="form.triggerType === Trigger.Webhook && webhookUrl && form.input!='' " class="detail-row">
          <span class="detail-label">Webhook Endpoint</span>
          <div class="webhook-box">
            <code>{{ webhookUrl }}</code>
            <button type="button" class="btn-copy" @click="copyWebhook">📋</button>
          </div>
        </div>

        <!-- Bundles summary -->
        <div class="divider"><span>Bundles ({{ form.bundles.length }})</span></div>

        <div v-if="form.bundles.length === 0" class="bundles-hint">
          No bundles configured. Edit the alert to add one.
        </div>

        <div v-for="(b, i) in form.bundles" :key="i" class="bundle-summary">
          <div class="bs-head">
            <span class="bs-tag">BUNDLE {{ i + 1 }}</span>
            <span class="bs-format">{{ b.formating }}</span>
          </div>
          <div class="bs-discussions">
            <span v-for="d in b.discussion_list" :key="d.id" class="bs-chip">{{ d.title }}</span>
            <span v-if="b.discussion_list.length === 0" class="bs-none">No discussions</span>
          </div>
          <span v-if="b.formating === Formatting.Custom && b.custom_script" class="bs-script-hint">
            Custom script ({{ b.custom_script.length }} chars)
          </span>
        </div>

      </div>

      <!-- Footer (view) -->
      <div class="editor-foot">
        <button type="button" class="btn-danger-ghost" @click="confirmingDelete = true">Delete</button>
        <div class="foot-spacer"></div>
        <ButtonPrimary @click="startEditing">Edit Alert </ButtonPrimary>
       </div>

    </template>

    <!-- ═══════════════════ EDIT MODE ═══════════════════════ -->
    <template v-else>

      <!-- Header (edit) -->
      <div class="editor-head">
        <div class="head-left">
          <span class="head-tag">{{ form.id ? `#${form.id}` : 'NEW' }}</span>
          <input v-model="form.title" type="text" placeholder="Alert title…" class="title-input" />
        </div>
        <div class="head-right">
          <button type="button" class="btn-ghost" @click="requestBack">← Back</button>
        </div>
      </div>

      <!-- Body (edit) -->
      <div class="editor-body">
        <div class="field">
          <label class="field-label">Description</label>
          <textarea v-model="form.description" rows="2" placeholder="What does this alert do?" class="field-input"></textarea>
        </div>

        <div class="field">
          <label class="field-label">Input Source <span class="req">*</span></label>
          <InputSourceSelector v-model="form.input" :locked="form.bundles.length > 0" @update:modelValue="onInputChange" />
        </div>

        <div v-if="form.input" class="field">
          <label class="field-label">Trigger</label>
          <TriggerSelector v-model="form.triggerType" :source="form.input" />
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

            <button type="button" class="new-bundle" @click="addBundle">
              <span class="nb-plus">+</span>
              <span>New Bundle</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Footer (edit) -->
      <div class="editor-foot">
        <div class="foot-spacer"></div>
        <ButtonPrimary :disabled="!form.title || saving" @click="save" > 
          {{ saving ? 'Saving…' : saveLabel }}
        </ButtonPrimary>
      </div>

    </template>

  </div>
</template>

<style scoped>
.editor {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #1d242e;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────── */
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}
.head-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.head-tag {
  background: #1e293b;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.head-right { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }

/* Edit-mode title input */
.title-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: #f1f5f9;
  font-size: 18px;
  font-weight: 600;
  padding: 4px 2px;
}
.title-input:focus { outline: none; border-bottom-color: #3b82f6; }
.title-input::placeholder { color: #475569; }

/* View-mode title */
.view-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Toggle ─────────────────────────────────────── */
.toggle-wrap { display: flex; align-items: center; gap: 8px; }
.toggle {
  width: 42px;
  height: 22px;
  border-radius: 11px;
  background: #334155;
  border: none;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  padding: 0;
}
.toggle.on { background: #2563eb; }
.toggle:disabled { opacity: 0.4; cursor: not-allowed; }
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle.on .knob { transform: translateX(20px); }
.toggle-label { font-size: 12px; color: #94a3b8; font-weight: 600; min-width: 54px; }

/* ── Body ───────────────────────────────────────── */
.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

/* ── View-mode detail rows ──────────────────────── */
.detail-row { display: flex; flex-direction: column; gap: 4px; }
.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-text { margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5; }
.detail-badge {
  display: inline-flex;
  align-items: center;
  background: #0f2744;
  border: 1px solid #1e40af;
  color: #93c5fd;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 5px;
  width: fit-content;
}
.detail-cols { display: flex; gap: 24px; flex-wrap: wrap; }

/* ── Bundle summary cards (view mode) ───────────── */
.bundle-summary {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bs-head { display: flex; align-items: center; justify-content: space-between; }
.bs-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}
.bs-format { font-size: 12px; color: #94a3b8; }
.bs-discussions { display: flex; flex-wrap: wrap; gap: 6px; }
.bs-chip {
  background: #0f2744;
  border: 1px solid #1e40af;
  color: #93c5fd;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}
.bs-none { color: #475569; font-size: 12px; font-style: italic; }
.bs-script-hint { color: #22c55e; font-size: 11px; }

/* ── Edit-mode fields ───────────────────────────── */
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.req { color: #ef4444; }
.field-input {
  padding: 9px 12px;
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid #1e293b;
  border-radius: 5px;
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.field-input:focus { outline: none; border-color: #3b82f6; }
.field-input::placeholder { color: #334155; }

/* ── Webhook box ────────────────────────────────── */
.webhook-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 5px;
  padding: 8px 12px;
}
.webhook-box code {
  color: #38bdf8;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.btn-copy { background: transparent; border: none; cursor: pointer; font-size: 14px; }

/* ── Divider ────────────────────────────────────── */
.divider { display: flex; align-items: center; gap: 10px; margin: 2px 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #1e293b; }
.divider span {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #475569;
}

.bundles-hint { color: #64748b; font-size: 12px; font-style: italic; margin: 0; }

.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.new-bundle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  background: transparent;
  border: 1px dashed #334155;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.new-bundle:hover { border-color: #3b82f6; color: #93c5fd; background: #0f172a; }
.nb-plus { font-size: 28px; line-height: 1; }

/* ── Footer ─────────────────────────────────────── */
.editor-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #1e293b;
  border-top: 1px solid #1e293b;
}
.foot-spacer { flex: 1; }

.btn-ghost {
  background: transparent;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.btn-ghost:hover { background: #1e293b; color: #f1f5f9; }

.btn-danger-ghost {
  background: transparent;
  border: 1px solid #7f1d1d;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.btn-danger-ghost:hover { background: #7f1d1d; color: #fff; }

/* ── Confirm overlays ───────────────────────────── */
.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.confirm-box {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 24px;
  max-width: 360px;
}
.confirm-box h4 { margin: 0 0 8px; color: #f1f5f9; font-size: 16px; }
.confirm-box p { margin: 0 0 18px; color: #94a3b8; font-size: 13px; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-danger {
  background: #dc2626;
  color: #fff;
  border: 1px solid #b91c1c;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.btn-danger:hover { background: #b91c1c; }
</style>
