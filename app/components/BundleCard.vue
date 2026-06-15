<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FormatEditor from './FormatEditor.vue'
import {
  Formatting,
  isPollingSource,
  type BundleModel,
  type DiscussionModel,
} from '#shared/constants'

const props = withDefaults(defineProps<{
  bundle: BundleModel
  availableDiscussions?: DiscussionModel[]
  discussionsLoading?: boolean
  inputSource?: string
  index: number
  hideRemove?: boolean
  /** Polling alerts pass their condition + a live payload so we can preview the default message. */
  alertContext?: any
  pollPayload?: any
  triggerParams?: any
}>(), {
  availableDiscussions: () => [],
  discussionsLoading: false,
  inputSource: '',
  hideRemove: false,
  alertContext: null,
  pollPayload: null,
  triggerParams: null,
})

const emit = defineEmits(['update:bundle', 'remove'])

const patch = (changes: Partial<BundleModel>) =>
  emit('update:bundle', { ...props.bundle, ...changes })

const discussions = computed<DiscussionModel[]>({
  get: () => props.bundle.discussion_list,
  set: (val) => patch({ discussion_list: val })
})

const formating = computed<Formatting>({
  get: () => props.bundle.formating,
  set: (val) => patch({ formating: val })
})

const isPolling = computed(() => isPollingSource(props.inputSource))

// Auto-promote stale webhook-style formats when the source is polling — and
// vice-versa — so the bundle always carries a format that makes sense for
// the alert it's attached to. Runs whenever the source changes.
watch(
  () => [props.inputSource, props.bundle.formating],
  ([src, current]) => {
    const polling = isPollingSource(String(src ?? ''))
    const isPollingFmt = current === Formatting.PollingDefault || current === Formatting.PollingCustom
    if (polling && !isPollingFmt) {
      patch({ formating: Formatting.PollingDefault })
    } else if (!polling && isPollingFmt) {
      patch({ formating: Formatting.Unformatted })
    }
  },
  { immediate: true },
)

const isEditorOpen = ref(false)

const onFormatChange = () => {
  if (formating.value === Formatting.Custom || formating.value === Formatting.PollingCustom) {
    isEditorOpen.value = true
  }
}

const saveScript = (script: string) => {
  patch({ custom_script: script })
  isEditorOpen.value = false
}

// Inline preview of the polling-default message (uses live payload if the
// parent passed one, otherwise placeholder text).
import { buildPollingDefaultMessage } from '#shared/pollingMessage'
const pollingPreview = computed(() => {
  if (!isPolling.value || formating.value !== Formatting.PollingDefault) return ''
  if (!props.alertContext) return ''
  return buildPollingDefaultMessage(props.alertContext, props.pollPayload ?? {})
})
</script>

<template>
  <div class="bundle-card">
    <FormatEditor
      v-if="isEditorOpen"
      :initial-script="bundle.custom_script || ''"
      :input-source="inputSource"
      :trigger-params="triggerParams ?? alertContext?.triggerParams"
      @save="saveScript"
      @close="isEditorOpen = false"
    />

    <div class="bundle-head">
      <span class="bundle-tag">BUNDLE {{ index + 1 }}</span>
      <button v-if="!hideRemove" type="button" class="bundle-remove" title="Remove bundle" @click="emit('remove')">✕</button>
    </div>

    <!-- Discussions -->
    <div class="bundle-field">
      <label class="bundle-label">Discussions</label>
      <DiscussionSelector
        v-model="discussions"
        :available="availableDiscussions"
        :is-loading="discussionsLoading"
      />
    </div>

    <!-- Format — options depend on whether the input source is polling. -->
    <div class="bundle-field">
      <label class="bundle-label">Message Format</label>
      <div class="format-row">
        <select v-model="formating" @change="onFormatChange" class="bundle-select">
          <template v-if="isPolling">
            <option :value="Formatting.PollingDefault">Default (watched fields)</option>
            <option :value="Formatting.PollingCustom">Custom (Handlebars)</option>
          </template>
          <template v-else>
            <option :value="Formatting.Unformatted">Brute (raw JSON)</option>
            <option :value="Formatting.Simple">Simple (title + description)</option>
            <option :value="Formatting.Custom">Custom (Handlebars)</option>
          </template>
        </select>
        <button
          v-if="formating === Formatting.Custom || formating === Formatting.PollingCustom"
          type="button"
          class="btn-edit-script"
          @click="isEditorOpen = true"
        >
          ✏️ Script
        </button>
      </div>

      <!-- Polling-default preview -->
      <pre
        v-if="formating === Formatting.PollingDefault"
        class="poll-preview"
      >{{ pollingPreview || 'Default polling message — fills in the watched paths and their observed values when the alert fires.' }}</pre>

      <span
        v-else-if="(formating === Formatting.Custom || formating === Formatting.PollingCustom) && bundle.custom_script"
        class="script-hint"
      >
        ✓ custom script set ({{ bundle.custom_script.length }} chars)
      </span>
    </div>
  </div>
</template>

<style scoped>
.bundle-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
}

.bundle-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bundle-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}
.bundle-remove {
  background: transparent;
  border: 1px solid #1e293b;
  color: #ef4444;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: all 0.15s;
}
.bundle-remove:hover { background: #1e293b; border-color: #ef4444; }

.bundle-field { display: flex; flex-direction: column; gap: 6px; }
.bundle-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.format-row { display: flex; gap: 8px; }
.bundle-select {
  flex: 1;
  padding: 9px 12px;
  background: #090d16;
  color: #f1f5f9;
  border: 1px solid #1e293b;
  border-radius: 5px;
  font-size: 13px;
}
.bundle-select:focus { outline: none; border-color: #3b82f6; }

.btn-edit-script {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  padding: 7px 16px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-edit-script:hover { background: #334155; border-color: #475569; }

.script-hint { font-size: 11px; color: #22c55e; }

.poll-preview {
  margin: 0;
  padding: 8px 10px;
  background: #0a1322;
  border: 1px dashed #1e40af;
  border-radius: 5px;
  color: #93c5fd;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
}
</style>
