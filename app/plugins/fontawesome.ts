// app/plugins/fontawesome.ts
// Centralized FontAwesome setup. Every icon used in the app must be added
// to `library` here — that's what lets `<FontAwesomeIcon>` find it by name
// across the codebase without re-importing per-file.
//
// Cherry-pick imports keep the bundle small: each `faXxx` is ~200 bytes;
// importing the whole pack (`import { fas } from '...'`) ships ~1.5MB.

import { library, config } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// ── FREE PATH (solid style) ─────────────────────────────────
import { faPencil,
          faPenToSquare,
          faCopy,
        } from '@fortawesome/free-solid-svg-icons'

import { faGithub } from '@fortawesome/free-brands-svg-icons'

// ── PRO PATH (light style) — uncomment when using Pro ───────
// import { faPencil } from '@fortawesome/pro-light-svg-icons'

// Required CSS — kills the flash of huge icons during SSR hydration
// (icons render at their intrinsic SVG size until this CSS sizes them down).
import '@fortawesome/fontawesome-svg-core/styles.css'

// We imported the CSS manually above, so tell the core not to inject it
// again at runtime (would otherwise duplicate styles).
config.autoAddCss = false

// Register every icon the app uses. Adding new icons later: import them
// here, append to library.add(...).
library.add(faPencil, 
            faPenToSquare, 
            faCopy,
            faGithub)

export default defineNuxtPlugin((nuxtApp) => {
  // Component name is PascalCase here; Vue will also resolve it as
  // <font-awesome-icon> in templates (Vue's auto-kebab-case conversion).
  nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})