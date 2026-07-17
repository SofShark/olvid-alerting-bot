// https://nuxt.com/docs/api/configuration/nuxt-config
//import { resolve } from "node:dns"
import { resolve } from "path";

export default defineNuxtConfig({
  typescript: {
    tsConfig: {
      compilerOptions: {
        useUnknownInCatchVariables: true
      }
    }
  },

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  // DATABASE_URL is read directly by server/db/prisma.ts at boot — no
  // runtimeConfig hop needed. See that module for the SQLite-default /
  // Postgres-opt-in switch.

  // Global stylesheet — design tokens + shared component classes. Loaded
  // before any component-scoped <style>, so scoped rules can still override.
  css: ["~/assets/css/main.css"],
  
  // Components live in domain subfolders for organization but keep flat,
  // unprefixed names in templates (<Stepper />, <BundleCard />, <AlertEditor />…).
  // `pathPrefix: false` makes Nuxt skip the directory name when synthesizing
  // the component name. TODO is this breaking the convention and nuxt good practives?
  components: [
    { path: "~/components/ui", pathPrefix: false },
    { path: "~/components/ui/overlay", pathPrefix: false },
    { path: "~/components/alert", pathPrefix: false },
    { path: "~/components/alert/view", pathPrefix: false },
    { path: "~/components/alert/wizard", pathPrefix: false },
    { path: "~/components/alert/wizard/steps", pathPrefix: false },
    { path: "~/components/input-source", pathPrefix: false },
    { path: "~/components/bundle", pathPrefix: false },
    { path: "~/components/bundle/format-editor", pathPrefix: false },
    { path: "~/components/condition", pathPrefix: false },
    { path: "~/components/monitoring", pathPrefix: false },
    { path: "~/components/payload", pathPrefix: false },
  ],

  alias: {
    // autoimport works for pages components etc but not necessarily for every other folder
    "@": resolve(__dirname, "/"),
  },

  // Auto-import the layered server-side architecture. Matches the implicit
  // auto-import that `server/utils/` already had (bdManager / alertManager
  // / daemonClient were used without explicit imports) — extended to the
  // new repositories / services / clients folders so the existing
  // convention keeps working after the split.
  nitro: {
    imports: {
      dirs: [
        "server/db",
        "server/repositories",
        "server/services",
        "server/clients",
        // Strategy + Factory folders — one object per Source / Formatting
        // value. Registered here so the factories resolve without imports.
        "server/services/dispatchers",
        "server/services/formatters",
        "server/services/testers",
      ],
    },
    
    //experimental: { tasks: true }, // Internal heartbeat that conditionally triggers the activation of scheduled alerts
    //scheduledTasks: {
      //"* * * * *": ["polling:heartbeat"],
    //},

  },

  modules: ['@nuxt/ui', "@nuxtjs/i18n", "@nuxt/eslint"],
  i18n: {
    bundle: {
      optimizeTranslationDirective: false,
    },
    locales: [
      { code: "en", name: "English", file: "en.json", language: "en-US" },
      { code: "fr", name: "Français", file: "fr.json", language: "fr-FR" },
      //{ code: 'sp', name: 'Español',  file: 'sp.json',language: 'sp-SP'}
    ],
    defaultLocale: "en",

    strategy: "no_prefix",

    detectBrowserLanguage: {
      useCookie: true,
    },
  },
});
