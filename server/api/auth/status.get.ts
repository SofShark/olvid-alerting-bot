// Public. Client uses this at boot to know:
//   - whether to redirect to /setup (no admin yet)
//   - whether to show mail-related UI (SMTP configured server-side)
import { userRepository } from "#server/repositories/userRepository";
import { mailClient } from "#server/clients/mailClient";
import type { AuthStatus } from "#shared/types/auth";

export default defineEventHandler(async (): Promise<AuthStatus> => {
  console.log(mailClient.isAvailable());
  return {
    needsSetup: (await userRepository.findFirstAdmin()) === null,
    mailEnabled: mailClient.isAvailable(),
  };
});
