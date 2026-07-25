// Public. `true` means no admin exists yet → global middleware sends
// visitors to /setup.
import { userRepository } from "#server/repositories/userRepository"
export default defineEventHandler(async () => {
  return { needsSetup: (await userRepository.findFirstAdmin() === null) };
});
