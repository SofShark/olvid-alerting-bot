import { z } from 'zod'

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(5),
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse)

  if (email === 'admin@admin.com' && password === 'admin') {
    // set the user session in the cookie
    // this server util is auto-imported by the auth-utils module
    await setUserSession(event, {
      user: {
        id: 1,
        login: 'user',
        name: 'Sofia',
      },
    })
    return {}
  }
  throw createError({
    status: 401,
    message: 'Bad credentials',
  })
})
