import type { DiscussionModel } from '#shared/types/discussion'

export default defineEventHandler(async (): Promise<DiscussionModel[]> => {
  const discussions = await olvidClient.getDiscussions()
  return discussions.map((d: any) => ({
    id: String(d.id),
    title: d.title + (d.identifier?.case === 'groupId' ? ' (group)' : '')
  }))
})
