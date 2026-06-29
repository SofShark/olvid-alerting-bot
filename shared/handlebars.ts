// Thin Handlebars wrapper used to render bundle scripts both in preview
// (FormatEditor) and at runtime (notifierService).
//
// `contains` helper registered globally: `{{#contains foo "needle"}}…{{/contains}}`
// returns the truthy branch when `foo` includes `needle` (case-insensitive).
// Useful for scripts that branch on a status string ("warning" / "error"
// / "info") without needing a full helper library.

import Handlebars from 'handlebars'

Handlebars.registerHelper('contains', function (this: any, haystack: string, needle: string, options: any) {
  if (haystack && typeof haystack === 'string' && haystack.toLowerCase().includes(needle.toLowerCase())) {
    return options.fn(this)
  }
  return options.inverse(this)
})

export const formatMessage = (script: string, payload: unknown): string => {
  const template = Handlebars.compile(script)
  return template(payload)
}
