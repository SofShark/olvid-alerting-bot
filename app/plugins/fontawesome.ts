// app/plugins/fontawesome.ts
// Centralized FontAwesome setup. Every icon used in the app must be added
// to `library` here — that's what lets `<FontAwesomeIcon>` find it by name
// across the codebase without re-importing per-file.
//
// Cherry-pick imports keep the bundle small: each `faXxx` is ~200 bytes;
// importing the whole pack (`import { fas } from '...'`) ships ~1.5MB.

import {
  library,
  config,
  type IconDefinition,
} from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

/* Cherry-picked icons — solid, regular and brand packs. */
import {
  faPencil,
  faPenToSquare,
  faTrashCan,
  faChevronRight,
  faChevronLeft,
  faCircleCheck,
  faCircleInfo,
  faDiagramProject,
  faCopy,
  faEllipsisVertical,
  faUserGear,
  faLeftRight,
  faPlay,
  faEnvelope
} from "@fortawesome/free-solid-svg-icons";

import { 
  faCircle, 

} from "@fortawesome/free-regular-svg-icons";

import { faGithub } from "@fortawesome/free-brands-svg-icons";

// ── PRO PATH (light style) — uncomment when using Pro ───────
// import { faPencil } from '@fortawesome/pro-light-svg-icons'

// Required CSS — kills the flash of huge icons during SSR hydration
// (icons render at their intrinsic SVG size until this CSS sizes them down).
import "@fortawesome/fontawesome-svg-core/styles.css";

// We imported the CSS manually above, so tell the core not to inject it
// again at runtime (would otherwise duplicate styles).
//config.autoAddCss = false;

// Two copies of `@fortawesome/fontawesome-common-types` end up in
// node_modules when `free-regular-svg-icons` and the other packs sit on
// different minor versions (7.2 vs 7.3 here). Same shape, different
// module identity → TS treats their `IconDefinition` as unrelated
// nominal types and `library.add(faCircle)` fails.
//
// The bridge cast is safe: the shape IS identical; the error is purely
// about identity. The proper fix lives in package.json (`overrides`
// block pins a single common-types version — see repo root); this cast
// keeps the build green even if the node_modules haven't been
// deduplicated yet.
const icons: IconDefinition[] = [
  faPencil,
  faPenToSquare,
  faGithub,
  faTrashCan,
  faChevronRight,
  faChevronLeft,
  faCircleCheck,
  faCircleInfo,
  faDiagramProject,
  faCircle as unknown as IconDefinition,
  faCopy,
  faEllipsisVertical,
  faUserGear,
  faLeftRight,
  faPlay,
  faEnvelope
];

library.add(...icons);

export default defineNuxtPlugin((nuxtApp) => {
  // Component name is PascalCase here; Vue will also resolve it as
  // <font-awesome-icon> in templates (Vue's auto-kebab-case conversion).
  nuxtApp.vueApp.component("FontAwesomeIcon", FontAwesomeIcon);
});
