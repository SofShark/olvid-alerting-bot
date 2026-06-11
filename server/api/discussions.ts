import { daemonClient } from '../utils/daemonClient'
import type { DiscussionModel } from '../../shared/constants'

export default defineEventHandler(async (): Promise<DiscussionModel[]> => {
  const discussions = await daemonClient.getDiscussions()
  return discussions.map((d: any) => ({
    id: String(d.id),
    title: d.title + (d.identifier?.case === 'groupId' ? ' (group)' : '')
  }))
})
