// Resolve a dot-separated path on an arbitrary JS object/array. Mirrors the
// shape produced by fast-xml-parser:
//   resolvePath(parsed, 'rss.channel.item.0.title') → "first item title"
//
// Numeric segments index into arrays. Unknown segments resolve to undefined
// (the evaluator interprets that as "no value yet").

export function resolvePath(obj: any, path: string): any {
  if (!path) return undefined
  const parts = path.split('.').filter(Boolean)
  let cur: any = obj
  for (const part of parts) {
    if (cur == null) return undefined
    cur = cur[part]
  }
  return cur
}
