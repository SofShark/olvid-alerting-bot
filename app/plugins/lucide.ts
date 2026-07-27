// app/plugins/lucide.ts
// Centralized Lucide icon registration. Every icon used in the app is
// registered as a global Vue component here — templates can then reference
// them as <LucidePencil />, <LucideTrash2 />, etc. without per-file imports.
//
// Why the `Lucide` prefix:
//   - Makes intent obvious in templates ("this is an icon").
//   - Avoids collisions with domain components (e.g. a future <Mail /> or
//     <Circle /> component won't clash with the icon).
//
// Adding a new icon:
//   1. import it from "@lucide/vue" below.
//   2. add it to the `icons` map with the Lucide<Name> key.
// Tree-shaking is automatic — only imported icons ship in the bundle.

import {
  Pencil,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  Circle,
  X,
  Copy,
  EllipsisVertical,
  UserCog,
  ArrowLeftRight,
  Play,
  Mail,
  SquareMousePointer,
  Moon,
  Sun,
  Globe,
  User,
  Bell,
  CircleQuestionMark,
  ChevronDown,
 
} from "@lucide/vue";

const icons = {
  LucidePencil: Pencil,
  LucideSquarePen: SquarePen,
  LucideTrash2: Trash2,
  LucideChevronLeft: ChevronLeft,
  LucideChevronRight: ChevronRight,
  LucideChevronDown: ChevronDown,
  LucideCircleCheck: CircleCheck,
  LucideInfo: Info,
  LucideCircle: Circle,
  LucideX: X,
  LucideCopy: Copy,
  LucideEllipsisVertical: EllipsisVertical,
  LucideArrowLeftRight: ArrowLeftRight,
  LucidePlay: Play,
  LucideMail: Mail,
  LucideSquareMousePointer: SquareMousePointer,
  LucideMoon: Moon,
  LucideSun: Sun,
  LucideGlobe: Globe,
  LucideUser: User,
  LucideUserCog: UserCog,
  LucideBell: Bell,
  LucideCircleQuestionMark: CircleQuestionMark,
};

export default defineNuxtPlugin((nuxtApp) => {
  for (const [name, component] of Object.entries(icons)) {
    nuxtApp.vueApp.component(name, component);
  }
});
