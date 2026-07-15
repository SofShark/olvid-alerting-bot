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

// Handlebars-reserved data variables. Inside `{{ ... }}`, these keep
// their special meaning and must NOT be wrapped in bracket-escapes.
// Everything else that starts with `@` (e.g. `{{@timestamp}}` on a
// Grafana/ELK payload) is a plain field name whose leading `@` would
// otherwise collide with the reserved-prefix syntax — those we escape
// as `[@name]`, which is Handlebars' documented way of referencing a
// property whose key starts with a special character.
const HANDLEBARS_RESERVED = new Set([
  "index",
  "key",
  "first",
  "last",
  "root",
  "level",
  "partial-block",
]);

export const formatMessage = (script: string, payload: unknown): string => {
  // Only run the escape inside `{{ ... }}` blocks — outside is user prose
  // and must be left verbatim. The `@..` / `@../foo` parent-context syntax
  // has a dot right after `@`, so the inner regex (`@\w+`) doesn't match
  // it, and it stays intact automatically.
  script = script.replace(/{{([\s\S]*?)}}/g, (mustache) =>
    mustache.replace(/(?<!\w)@([\w-]+)/g, (match, name) =>
      HANDLEBARS_RESERVED.has(name) ? match : `[@${name}]`,
    ),
  );

  const template = Handlebars.compile(script);
  return template(payload);
};
