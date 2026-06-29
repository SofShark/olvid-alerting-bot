<script setup lang="ts">
/*
  Generic overlay shell. Teleports to <body> so it escapes any ancestor
  stacking context or overflow:hidden. Reuses the global .overlay / .overlay-box
  tokens defined in tokens.css — no styles owned here.

  Slot for content. The host decides the buttons / footer / etc.; for the
  common "title + message + confirm/cancel" shape, use ConfirmDialog instead.
*/
const props = withDefaults(
  defineProps<{
    open: boolean;
    closeOnBackdrop?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
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
      <div class="overlay-box">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
