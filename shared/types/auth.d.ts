// Module augmentation for nuxt-auth-utils. The module ships `User` as an
// intentionally empty interface — projects extend it here to declare the
// shape of their session. Add fields as you persist them in
// `setUserSession(...)` on the server side.
//
// Docs: https://github.com/atinux/nuxt-auth-utils#session-data

declare module "#auth-utils" {
  interface User {
    id: numberM
    login: string;
    name: string;
    // e.g. id: number; email: string; role: "admin" | "member";
  }
}

export {};
