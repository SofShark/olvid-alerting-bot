<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Formatting,
  isPollingSource,
  type BundleModel,
  type DiscussionModel,
} from '#shared/constants'
import { buildPollingDefaultMessage } from '#shared/pollingMessage'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const { t } = useI18n()

const props = withDefaults(defineProps<{
  bundle: BundleModel
  availableDiscussions?: DiscussionModel[]
  discussionsLoading?: boolean
  inputSource?: string
  index: number
  hideRemove?: boolean
  /** True when this card is rendered inside the alert *view* — disable all
   *  controls so the user inspects without mutating. Implies hideRemove. */
  readonly?: boolean
  /** When the card is readonly AND editable, show an "Edit" button in the
   *  header so the parent can open its own editor for this bundle. */
  editable?: boolean
  /** Polling alerts pass their condition + a live payload so we can preview the default message. */
  alertContext?: any
  pollPayload?: any
  alertParams?: any
}>(), {
  availableDiscussions: () => [],
  discussionsLoading: false,
  inputSource: '', 
  hideRemove: false,
  readonly: false,
  editable: false,
  alertContext: null,
  pollPayload: null,
  alertParams: null,
})

const emit = defineEmits(['update:bundle', 'remove', 'edit'])

const patch = (changes: Partial<BundleModel>) =>
  emit('update:bundle', { ...props.bundle, ...changes })

// Bundle title — surfaces the Bundle.name DB column in the edit UI.
// Optional; the view-mode falls back to "Bundle N" when empty.
const bundleName = computed<string>({
  get: () => props.bundle.name ?? '',
  set: (val) => patch({ name: val.trim() || undefined }),
})

const discussions = computed<DiscussionModel[]>({
  get: () => props.bundle.discussion_list,
  set: (val) => patch({ discussion_list: val })
})

const formating = computed<Formatting>({
  get: () => props.bundle.formating,
  set: (val) => patch({ formating: val })
})

const isPolling = computed(() => isPollingSource(props.inputSource))

// Option set offered by the format dropdown. Driven by the alert's source —
// polling alerts get the watched-field-aware formats, everything else gets
// the classic webhook-style options.
const formatOptions = computed(() =>
  isPolling.value
    ? [
        { value: Formatting.PollingDefault, label: t('bundleCard.format.pollingDefault') },
        { value: Formatting.PollingCustom,  label: t('bundleCard.format.pollingCustom') },
      ]
    : [
        { value: Formatting.Unformatted, label: t('bundleCard.format.unformatted') },
        { value: Formatting.Simple,      label: t('bundleCard.format.simple') },
        { value: Formatting.Custom,      label: t('bundleCard.format.custom') },
      ],
)

// Auto-promote stale webhook-style formats when the source is polling — and
// vice-versa — so the bundle always carries a format that makes sense for
// the alert it's attached to. Skipped in readonly (view) mode: nothing
// should mutate when the user is only inspecting.
watch(
  () => [props.inputSource, props.bundle.formating],
  ([src, current]) => {
    if (props.readonly) return
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
const pollingPreview = computed(() => {
  if (!isPolling.value || formating.value !== Formatting.PollingDefault) return ''
  if (!props.alertContext) return ''
  return buildPollingDefaultMessage(props.alertContext, props.pollPayload ?? {})
})
</script>

<template>
  <div class="card bundle-card">
    <FormatEditor
      v-if="isEditorOpen"
      :initial-script="bundle.custom_script || ''"
      :input-source="inputSource"
      :alert-params="alertParams ?? alertContext?.alertParams"
      :alert-id="alertContext?.id ?? null"
      @save="saveScript"
      @close="isEditorOpen = false"
    />

    <div class="card-head">
      <span class="card-tag">{{ $t('bundleCard.tag', { n: index + 1 }) }}</span>
      <button
        v-if="!hideRemove && !readonly"
        type="button"
        class="card-remove"
        :title="$t('bundleCard.removeTitle')"
        @click="emit('remove')"
      >✕</button>
      <button
        v-else-if="readonly && editable"
        type="button"
        class="card-edit"
        :title="$t('bundleCard.editTitle')"
        @click="emit('edit')"
      > <FontAwesomeIcon :icon="['fas', 'pencil']" />{{ $t('bundleCard.editButton') }}</button>
    </div>

    <!-- Title — optional. Surfaces Bundle.name. Falls back to "Bundle N"
         in view mode when left blank. Raw strings here per project's
         current "no i18n on new copy" pass. -->
    <div class="field">
      <label class="field-label">Title</label>
      <input
        v-model="bundleName"
        type="text"
        class="field-input"
        :placeholder="`Bundle ${index + 1}`"
        :disabled="readonly"
      />
    </div>

    <!-- Discussions -->
    <div class="field">
      <label class="field-label">{{ $t('bundleCard.fields.discussions') }}</label>
      <DiscussionSelector
        v-model="discussions"
        :available="availableDiscussions"
        :is-loading="discussionsLoading"
        :readonly="readonly"
      />
    </div>

    <!-- Format — options depend on whether the input source is polling. -->
    <div class="field">
      <label class="field-label">{{ $t('bundleCard.fields.format') }}</label>
      <div class="format-row">
        <Select
          v-model="formating"
          :options="formatOptions"
          :disabled="readonly"
          class="format-select"
          @update:model-value="onFormatChange"
        />
        <button
          v-if="(formating === Formatting.Custom || formating === Formatting.PollingCustom) && !readonly"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="isEditorOpen = true"
        >
          <FontAwesomeIcon :icon="['fas', 'pencil']" />

          <!--✏️--> {{ $t('bundleCard.scriptButton') }}
        </button>
      </div>

      <!-- Polling-default preview -->
      <pre
        v-if="formating === Formatting.PollingDefault"
        class="poll-preview"
      >{{ pollingPreview || $t('bundleCard.previewPlaceholder') }}</pre>

      <!--span
        v-else-if="(formating === Formatting.Custom || formating === Formatting.PollingCustom) && bundle.custom_script"
        class="script-hint"
      >
        ✓ custom script set ({{ bundle.custom_script.length }} chars)
      </span-->
    </div>
  </div>
</template>

<style scoped>
/* All structural surfaces (card frame, head, tag, remove button, field
 * label/input, secondary button) come from the global stylesheet. Only the
 * pieces specific to BundleCard (format-row composition, polling-preview
 * box, script-hint) live here.
 */

/* Edit button in the header for readonly+editable cards. Pill-shaped accent
 * button that sits where the × normally lives. */
.card-edit {
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-border);
  color: var(--color-accent-text);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color .15s, color .15s, border-color .15s;
}
.card-edit:hover {
  background: var(--color-accent);
  border-color: var(--color-accent-hover);
  color: var(--color-text-on-accent);
}

.format-row { display: flex; gap: var(--space-3); }
.format-select { flex: 1; }

.script-hint { font-size: var(--text-sm); color: var(--color-success); }

.poll-preview {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-input);
  border: 1px dashed var(--color-accent-border);
  border-radius: var(--radius-md);
  color: var(--color-accent-text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
}
</style>
