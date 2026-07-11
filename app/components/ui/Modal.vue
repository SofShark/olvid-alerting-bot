<script setup lang="ts">
/*
  Generic overlay shell. Teleports to <body> so it escapes any ancestor
  stacking context or overflow:hidden. Reuses the global .overlay /
  .overlay-box tokens defined in overlay.css.

  Slot for content. The host decides the buttons / footer / etc.; for
  the common "title + message + confirm/cancel" shape, use ConfirmDialog.

  Sizes:
    · compact — 420px cap. Two/three-button prompts (delete? discard?).
    · default — 560px cap. Standard forms with a few fields.
    · wide    — 700px cap. Richer content, still centered.
    · full    — 92vw × 80vh. The bundle editor / any modal that hosts
                its own scrolling body.
  Every size caps at 92vw so mobile doesn't overflow.
*/

const props = withDefaults(
  defineProps<{
    open: boolean;
    closeOnBackdrop?: boolean;
    size?: "compact" | "default" | "wide" | "full";
  }>(),
  {
    closeOnBackdrop: true,
    size: "default",
  },
);

const emit = defineEmits<{ (e: "close"): void }>();

const onBackdrop = () => {
  if (props.closeOnBackdrop) emit("close");
};
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="onBackdrop">
      <div class="overlay-box" :class="`overlay-box--${size}`">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
