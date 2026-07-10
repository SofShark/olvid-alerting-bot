// GET /api/alerts/:id/logs → most-recent-first, capped at 200 (the same
// cap the writer enforces). Consumed by useAlertLogs on the client side.

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "id");
  const id = Number(raw);
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid alert id" });
  }
  return await alertLogRepository.getForAlert(id);
});
