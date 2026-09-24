// Fetch + parse a URL — used by the wizard's ConditionEditor "Retrieve" button.
// Side-effect-free: does not touch any alert or DB row.

import { pollingEngine } from "../../utils/engine";

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  try {
    const body = await readBody<{ url?: string; format?: string }>(event);
    const url = (body?.url ?? "").trim();
    const format = (body?.format ?? "").trim();
    return await pollingEngine.retrieve(url, format);
  } catch (e: any) {
    console.error("[POST /api/poll/retrieve] unexpected:", e);
    return {
      ok: false,
      url: "",
      format: "",
      error: e?.message ?? "Unexpected server error in /api/poll/retrieve",
    };
  }
});
