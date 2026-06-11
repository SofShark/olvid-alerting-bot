import Parser from 'rss-parser'
import type { RSSParams } from '#shared/constants'

const parser = new Parser()

/**
 * One polling tick for an RSS/Atom alert.
 *
 * Fetches the feed, finds items newer than the last seen guid, applies an
 * optional keyword filter, and fires alertManager.processAlert() once per
 * matching item (oldest first). Persists the updated _lastSeenId.
 */
export async function tickRSS(alert: any): Promise<void> {
  const params = (alert.triggerParams ?? {}) as RSSParams

  if (!params.url) {
    console.warn(`⚠️ [RSS] Alert #${alert.id} has no URL configured — skipping`)
    return
  }

  let feed: Parser.Output<any>
  try {
    feed = await parser.parseURL(params.url)
  } catch (err: any) {
    console.error(`❌ [RSS] Alert #${alert.id} — failed to fetch ${params.url}:`, err.message)
    return
  }

  const items: Parser.Item[] = feed.items ?? []
  const lastSeenId = params._lastSeenId ?? null

  // Find the index of the last seen item (guid or link as fallback).
  const lastIndex = lastSeenId
    ? items.findIndex(i => (i.guid ?? i.link) === lastSeenId)
    : -1

  // Items before lastIndex (or all items on first run) are "new".
  // Feeds are newest-first, so new items are those with index < lastIndex.
  // On first run (lastIndex === -1) we treat only the first item as "new"
  // to avoid flooding all existing items.
  let newItems: Parser.Item[]
  if (lastSeenId === null) {
    newItems = items.slice(0, 1)  // first run: baseline only
  } else if (lastIndex === -1) {
    newItems = items              // last seen item fell off the feed — treat all as new
  } else {
    newItems = items.slice(0, lastIndex)
  }

  // Apply optional keyword filter (title + contentSnippet).
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    newItems = newItems.filter(i =>
      (i.title ?? '').toLowerCase().includes(kw) ||
      (i.contentSnippet ?? '').toLowerCase().includes(kw)
    )
  }

  if (newItems.length === 0) {
    console.log(`🔄 [RSS] Alert #${alert.id} — no new items`)
    return
  }

  console.log(`🔔 [RSS] Alert #${alert.id} — ${newItems.length} new item(s)`)

  // Fire oldest first (reverse so the sidebar shows them chronologically).
  for (const item of [...newItems].reverse()) {
    const payload = {
      item: {
        title:          item.title          ?? '',
        link:           item.link           ?? '',
        pubDate:        item.pubDate        ?? '',
        contentSnippet: item.contentSnippet ?? '',
        guid:           item.guid           ?? item.link ?? '',
      },
      feedTitle: feed.title ?? params.url,
    }
    await alertManager.processAlert(alert, payload)
  }

  // Persist the new "last seen" id.
  const newestItem = items[0]
  const newLastId  = newestItem ? (newestItem.guid ?? newestItem.link ?? '') : lastSeenId
  await bdManager.updateTriggerParams(alert.id, { ...params, _lastSeenId: newLastId })
}
