<script setup lang="ts">
// Chrome for the four auth-flow pages (login, invite, verify, setup).
// Each one used to hand-roll <div class="overlay"><div class="overlay-box
// overlay-box--compact">…</div></div>; this component owns that shape so
// the pages become just their heading + form + messages.
//
// The wrapper deliberately does NOT use <Modal> — these pages are the
// route content, not dismissable overlays, so the focus-trap / teleport /
// close-on-escape behaviour of Modal is the wrong fit here.
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <slot />
    </div>
  </div>
</template>
