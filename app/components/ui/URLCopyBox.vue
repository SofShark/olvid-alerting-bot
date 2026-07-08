<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { ref } from "vue";

const props = defineProps<{ url: string }>();

// Brief visual feedback on copy — icon swap + scale pulse for ~1.4s. Clears
// any in-flight timeout so rapid-fire clicks always restart the cycle from
// "just copied" rather than blinking back to idle mid-pulse.
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
const copyWebhook = () => {
  if (!props.url) return;
  navigator.clipboard?.writeText(props.url);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
  }, 1400);
};
</script>
<template>
  <div class="url-box">
    <code>{{ props.url }}</code>
    <button
      type="button"
      class="btn-copy"
      :class="{ copied }"
      :title="
        copied ? $t('urlCopyBox.copiedTitle') : $t('urlCopyBox.copyTitle')
      "
      @click="copyWebhook"
    >
    <span v-if="copied"> ✓ </span>
    <span v-else > <FontAwesomeIcon class="clipboard-icon" :icon="['fas', 'copy']"/>  </span>
      <!--span class="copy-icon"> {{ copied ? "✓" : "📋" }}</span-->
    </button>
  </div>
</template>

<style>
.url-box {
  display: flex;
  align-items: center;
  height: 35px;
  min-width: 30%;
  gap: var(--space-3);
  background: var(--color-bg-code);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.url-box code {
  color: var(--color-text-webhook);
  font-size: var(--text-md);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.clipboard-icon{
  color: #bebebe;
}
/* Copy button — small scale + color pulse on click, swaps to ✓ for ~1.4s.
 * Used a CSS animation rather than a one-shot scale so consecutive clicks
 * always restart the pulse cleanly. */
.btn-copy {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 25px;
  font-size: var(--text-lg);
  line-height: 1;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition:
    color 0.15s,
    background-color 0.15s,
    transform 0.1s;
}
.btn-copy:hover {
  background: var(--color-border-code);
}
.btn-copy:active {
  transform: scale(0.88);
}
.btn-copy.copied {
  color: var(--color-success);
  animation: copy-pulse 0.45s ease-out;
}
.btn-copy.copied:hover {
  background: transparent;
}

@keyframes copy-pulse {
  0% {
    transform: scale(0.85);
  }
  50% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
</style>
