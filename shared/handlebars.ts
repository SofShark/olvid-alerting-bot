// Handlebars wrapper used to render bundle scripts both in preview
// (FormatEditor) and at runtime (notifierService).
//
// `contains` helper registered globally: `{{#contains foo "needle"}}…{{/contains}}`
// returns the truthy branch when `foo` includes `needle` (case-insensitive).
// Useful for scripts that branch on a status string ("warning" / "error"
// / "info") without needing a full helper library.

import Handlebars from "handlebars";

Handlebars.registerHelper(
  // TODO : Offer helpers to simplify handling of field values
  "contains",
  function (this: any, haystack: string, needle: string, options: any) {
    if (
      haystack &&
      typeof haystack === "string" &&
      haystack.toLowerCase().includes(needle.toLowerCase())
    ) {
      return options.fn(this);
    }
    return options.inverse(this);
  },
);

export const formatMessage = (script: string, payload: unknown): string => {

  // Escape safely path element starting with @ to avoid collision with handlebars 
  // predefined helpers (such as @index)
  script = script.replace(/{{([\s\S]*?)}}/g, (match) => {
    return match.replace(/(?<!\w)@([\w-]+)/g, '[@$1]');
  });
  
  const template = Handlebars.compile(script);
  return template(payload);
};
