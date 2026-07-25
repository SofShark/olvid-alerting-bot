<script setup lang="ts">
const { loggedIn, user, fetch: refreshSession } = useUserSession()
const credentials = reactive({
  email: '',
  password: '',
})
async function login () {
  try {
    // Move to service-composable
    await $fetch('/api/login', {
      method: 'POST',
      body: credentials,
    })

    // Refresh the session on client-side and redirect to the home page
    await refreshSession()
    await navigateTo('/')
  } catch {
    alert('Bad credentials')
  }
}
</script>

<template>
  <div class="overlay">
    <div class="overlay-box overlay-box--compact">
      <h4>Sign in</h4>
      <form class="login-form" @submit.prevent="login">
        <input
          v-model="credentials.email"
          class="field-input"
          type="email"
          placeholder="Email"
          autocomplete="username"
        />
        <input
          v-model="credentials.password"
          class="field-input"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />
        <button type="submit" class="btn btn-primary">Login</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
</style>
