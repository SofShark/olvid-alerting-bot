import { olvidClient } from "#server/clients/olvidClient";

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = BigInt(getRouterParam(event, "id")!);

  const image = await olvidClient.getDiscussionPhoto(id);

  if (!image) {
    throw createError({
      statusCode: 404,
      statusMessage: "Photo not found",
    });
  }

  setHeader(event, "Content-Type", "image/jpeg");
  return image;
});
