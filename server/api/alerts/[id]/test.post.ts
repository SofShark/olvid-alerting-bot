// Unified "run this alert once" endpoint. The URL identifies the
// alert; the server figures out whether that means polling or
// monitoring via `alertTester`. Client code POSTs to one URL — the
// browser never learns which source flavour it's testing.
//
// Returns AlertTestResult (see #shared/types/testResult). Errors that
// belong INSIDE the envelope (fetch fail, no params, condition
// missing) resolve with `ok: false`; only unrecoverable request-level
// problems (missing id, alert not found) throw a `createError`.

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);
  if (!id || Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid alert id",
    });
  }

  const alert = await alertRepository.getById(id);
  if (!alert) {
    throw createError({
      statusCode: 404,
      statusMessage: `Alert #${id} not found`,
    });
  }

  return await alertTester.test(alert);
});
