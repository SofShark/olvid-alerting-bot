// https://nuxt.com/docs/api/configuration/nuxt-config
//import { resolve } from "node:dns"
import {resolve} from "path"
import tailwindcss from "@tailwindcss/vite";


export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }, 
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:@localhost:5432/mi_base_datos?schema=public"
  },

  alias: {
    // autoimport works for pages components etc but not necessarily for every other folder
    "@": resolve(__dirname, "/")
  },
  /*
  nitro:{
    experimental : {tasks: true},
    scheduledTasks :{
      '* * * * *': ['cron:heartbeat'] // Ticks every minute
    }
  }
  */

})
