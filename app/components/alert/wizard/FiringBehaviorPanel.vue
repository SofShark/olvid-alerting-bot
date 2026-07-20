<script setup lang="ts">
import { ref } from "vue";
import { TriggerMode } from "#shared/types/polling";

/*
  Source-agnostic "Firing behavior" panel — the same block rendered
  under both polling ConditionEditor and monitoring StatusMatchEditor
  in wizard step 2. Concentrates the concepts of "WHEN does a match
  actually notify?" separately from "WHAT counts as a match?".

  Two rows today:
    · Trigger mode  → segmented pills (Every time / Once / Once + recovery)
    · Datapoints   → "Fire after N of last M evaluations match" (MOCKUP)

  Datapoints is a UI-only mockup right now — the inputs live in local
  state and are NOT persisted. The runtime keeps behaving as N=M=1.
  Wiring persistence + the runtime confirmation window is a follow-up
  task; the shape is here so we can iterate on the UX first.

  The trigger-mode row can be hidden via `showTriggerMode=false` — used
  by polling for edge-native conditions (kind=None or operator=Changed)
  where the engine ignores the mode.
*/

const model = defineModel<TriggerMode>({ required: true });

withDefaults(
  defineProps<{
    variant: "polling" | "monitoring";
    /** Hide the trigger-mode row when the engine ignores it. */
    showTriggerMode?: boolean;
  }>(),
  { showTriggerMode: true },
);

// Datapoints — mockup only, local state. Bounded 1..10 to keep the UI
// sane; real limit will live in the runtime when persistence lands.
const datapointsN = ref(1);
const datapointsM = ref(1);

// N cannot exceed M — clamp on input so the sentence never reads
// "3 of 2".
function onNInput(e: Event) {
  const v = Math.max(
    1,
    Math.min(10, Number((e.target as HTMLInputElement).value) || 1),
  );
  datapointsN.value = Math.min(v, datapointsM.value);
}
function onMInput(e: Event) {
  const v = Math.max(
    1,
    Math.min(10, Number((e.target as HTMLInputElement).value) || 1),
  );
  datapointsM.value = v;
  if (datapointsN.value > v) datapointsN.value = v;
}
</script>

<template>
  <div class="wcard">
    <div class="wcard-head">{{ $t("wizard.firingBehavior.title") }}</div>
    <div class="wcard-body">
      <!-- Trigger mode row -->
      <div v-if="showTriggerMode" class="wcard-row">
        <span class="wcard-label">{{
          $t("wizard.firingBehavior.triggerModeLabel")
        }}</span>
        <TriggerModePicker v-model="model" :variant="variant" />
      </div>

      <!-- Datapoints row — MOCKUP, not persisted yet.
           <i18n-t> weaves the two number inputs into the localised
           sentence via named slots {n} and {m}, so translators can
           reorder the placeholders as needed without breaking the UI. -->
      <div class="wcard-row">
        <span class="wcard-label">{{
          $t("wizard.firingBehavior.datapointsLabel")
        }}</span>
        <div class="datapoints">
          <i18n-t
            keypath="wizard.firingBehavior.datapointsSentence"
            tag="p"
            class="datapoints-sentence"
          >
            <template #n>
              <input
                type="number"
                min="1"
                max="10"
                class="dp-input"
                :value="datapointsN"
                @input="onNInput"
              />
            </template>
            <template #m>
              <input
                type="number"
                min="1"
                max="10"
                class="dp-input"
                :value="datapointsM"
                @input="onMInput"
              />
            </template>
          </i18n-t>
          <p class="datapoints-hint">
            {{ $t("wizard.firingBehavior.datapointsHint") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card chrome delegated to the shared .wcard/.wcard-head/.wcard-body/
 * .wcard-row/.wcard-label classes (see app/assets/css/components/wcard.css)
 * — same shape as ConditionEditor + StatusMatchEditor. */

/* Datapoints — inline number inputs woven into a sentence. */
.datapoints {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.datapoints-sentence {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--color-text-primary);
  font-size: var(--text-md);
}
.dp-input {
  width: 56px;
  padding: 4px var(--space-2);
  text-align: center;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-md);
  font-weight: 600;
}
.dp-input:focus {
  outline: none;
  border-color: var(--color-accent);
}
.datapoints-hint {
  margin: 0;
  color: var(--color-text-dim);
  font-size: var(--text-sm);
  line-height: 1.5;
}
</style>
