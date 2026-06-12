// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }, //false?
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:@localhost:5432/mi_base_datos?schema=public"
  },
  /*
  css: [],
  vite: {
    ssr: {
      noExternal: []
    }
  }*/
})
