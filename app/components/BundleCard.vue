<script setup lang="ts">
import { ref, computed } from 'vue'
import FormatEditor from './FormatEditor.vue'
import { Formatting, type BundleModel, type DiscussionModel } from '#shared/constants'

const props = withDefaults(defineProps<{
  bundle: BundleModel
  availableDiscussions?: DiscussionModel[]
  discussionsLoading?: boolean
  inputSource?: string
  index: number
}>(), {
  availableDiscussions: () => [],
  discussionsLoading: false,
  inputSource: ''
})

const emit = defineEmits(['update:bundle', 'remove'])

// Helper: emit a patched copy of the bundle.
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

const isEditorOpen = ref(false)

const onFormatChange = () => {
  if (formating.value === Formatting.Custom) isEditorOpen.value = true
}

const saveScript = (script: string) => {
  patch({ custom_script: script })
  isEditorOpen.value = false
}
</script>

<template>
  <div class="bundle-card">
    <FormatEditor
      v-if="isEditorOpen"
      :initial-script="bundle.custom_script || ''"
      :input-source="inputSource"
      @save="saveScript"
      @close="isEditorOpen = false"
    />

    <div class="bundle-head">
      <span class="bundle-tag">BUNDLE {{ index + 1 }}</span>
      <button type="button" class="bundle-remove" title="Remove bundle" @click="emit('remove')">✕</button>
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

    <!-- Format -->
    <div class="bundle-field">
      <label class="bundle-label">Message Format</label>
      <div class="format-row">
        <select v-model="formating" @change="onFormatChange" class="bundle-select">
          <option :value="Formatting.Unformatted">Brute — raw JSON payload</option>
          <option :value="Formatting.Simple">Simple — title + description</option>
          <option :value="Formatting.Custom">Custom — Handlebars script</option>
        </select>
        <button
          v-if="formating === Formatting.Custom"
          type="button"
          class="btn-edit-script"
          @click="isEditorOpen = true"
        >
          ✏️ Script
        </button>
      </div>
      <span v-if="formating === Formatting.Custom && bundle.custom_script" class="script-hint">
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
</style>
