<script setup lang="ts">
// Small "?" bubble that reveals an explanatory message on hover or
// keyboard focus. The bubble is positioned outside the trigger's
// bounding box, so if we relied purely on CSS :hover the cursor
// would lose the hover state the moment it crossed the gap between
// icon and bubble. We drive show/hide via JS with a short grace
// period on close, which lets the cursor traverse the gap without
// the bubble collapsing under it.

defineProps<{ message: string }>();

const show = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function open() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  show.value = true;
}

function scheduleClose() {
  if (hideTimer) clearTimeout(hideTimer);
  // 120 ms is enough to bridge the icon → bubble gap without feeling
  // sticky when the user genuinely moves away.
  hideTimer = setTimeout(() => {
    show.value = false;
    hideTimer = null;
  }, 120);
}

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <span
    class="tooltip-container"
    tabindex="0"
    role="button"
    :aria-label="message"
    @mouseenter="open"
    @mouseleave="scheduleClose"
    @focusin="open"
    @focusout="scheduleClose"
  >
    <span class="help-tooltip-icon" aria-hidden="true">?</span>

    <!-- Bubble stays in the DOM so it can catch its own mouseenter /
         mouseleave and keep the tooltip open while the cursor is on it. -->
    <span
      class="tooltip-bubble"
      :class="{ 'is-visible': show }"
      role="tooltip"
      @mouseenter="open"
      @mouseleave="scheduleClose"
    >
      {{ message }}
    </span>
  </span>
</template>

<style scoped>
.tooltip-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  margin-left: var(--space-2);
  cursor: help;
  font-size: 11px;
  outline: none;
}
.tooltip-container:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 50%;
}

.help-tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-top: 0%; /* Balance visual weight of ? symbol */
  padding-left: 10%;

  width: 10px;
  height: 10px;
  border-radius: 50%;

  background-color: var(--color-accent-soft);
  border: 1px solid var(--color-accent);
  color: var(--color-accent);

  font-family: var(--font-sans);
  font-size: 8px;
  font-weight: 400;
  line-height: 1;



  text-align: center;
}

/* Help message bubble — hidden by default, revealed by the JS-driven
 * `is-visible` class. `visibility: hidden` + `pointer-events: none`
 * jointly guarantee the invisible bubble neither renders nor catches
 * stray hover events; `.is-visible` flips both on. */
.tooltip-bubble {
  position: absolute;
  top: -15px;
  left: 100%;
  /* No horizontal gap between the icon's right edge and the bubble.
   * Keeps the surface contiguous so the JS grace period isn't doing
   * all the work — the mouse rarely leaves the container in the
   * first place. */
  margin-left: 0;

  background-color: var(--color-accent-soft);
  color: var(--color-accent-text);
  border: 1px solid var(--color-accent-border);
  padding: 6px 10px;
  border-radius: 16px 16px 16px 0;
  font-size: 11px;
  font-weight: normal;
  text-transform: none;
  white-space: nowrap;
  
  box-shadow:
    3px 4px 6px -1px rgb(0 0 0 / 0.1),
    1px 2px 4px -2px rgb(0 0 0 / 0.3);

  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(4px);

  transition:
    opacity 0.15s ease,
    transform 0.2s ease,
    visibility 0s linear 0.15s;
  z-index: 50;
}

.tooltip-bubble.is-visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(-10px);
  transition:
    opacity 0.15s ease,
    transform 0.2s ease,
    visibility 0s linear 0s;
}
</style>
