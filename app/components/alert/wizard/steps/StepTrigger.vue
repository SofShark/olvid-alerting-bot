<script setup lang="ts">
import type { AlertModel } from '#shared/types/alert'

/*
  Step 2 (polling only): ConditionEditor.

  Re-emits `update:payload` upward so the wizard can pipe the parsed
  payload into the BundleCard preview on step 3. The condition itself
  is written into `form.alertParams.condition` directly.
*/

const form = defineModel<AlertModel>({ required: true })

defineEmits<{ (e: 'update:payload', v: any): void }>()

const condition = computed({
  get: () => (form.value.alertParams as any)?.condition,
  set: (v) => {
    if (!form.value.alertParams) return
    form.value.alertParams = { ...form.value.alertParams, condition: v }
  },
})
</script>

<template>
  <ConditionEditor
    :model-value="condition"
    :url="(form.alertParams as any)?.url"
    :format="(form.alertParams as any)?.format"
    @update:model-value="condition = $event"
    @update:payload="$emit('update:payload', $event)"
  />
</template>
