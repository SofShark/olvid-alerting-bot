// Boots the Olvid daemon event listener once, at Nitro server start. 
import { startUpdater } from "../clients/updaterClient";

export default defineNitroPlugin(() => {
  startUpdater().catch((err) => {
    console.error("[Olvid updater] fatal:", err);
  });
});
