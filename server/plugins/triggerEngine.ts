export default defineNitroPlugin(async () => {
  console.log('🚀 [Engine] Starting trigger engine…')
  await triggerEngine.initialize()
})
