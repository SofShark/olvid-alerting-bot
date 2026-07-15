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
// their special meaning — but ONLY when they stand alone (no dot
// immediately before or after). The moment a dot is adjacent, we treat
// the `@name` as part of a path referencing a field whose key starts
// with `@` (a common shape in Grafana / ELK / OpenSearch payloads, e.g.
// `@timestamp`, `@version`), and wrap it in the bracket-escape
// (`[@name]`) that Handlebars documents for special-character keys.
//
// Reserved data-vars, per the Handlebars docs:
//   @index          — iteration index inside `{{#each array}}`
//   @key            — object key inside `{{#each object}}`
//   @first, @last   — boolean iteration edges
//   @root           — top-level context
//   @level          — logging level in `{{log}}`
//   @partial-block  — the block passed to a partial
// Parent-context syntax (`@..` / `@../foo`) has a dot right after `@`,
// so the inner regex (`@\w+`) doesn't match it and it stays intact.
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
  // and must be left verbatim.
  //
  // Inside each mustache we split around already-existing `[...]`
  // bracket-escapes and skip them, so a script that already writes
  // `{{[@timestamp]}}` doesn't get double-wrapped into
  // `{{[[@timestamp]]}}` (which crashes the parser). The @-rewrite
  // then runs only on the un-bracketed segments.
  script = script.replace(/{{([\s\S]*?)}}/g, (_full, inner: string) => {
    const parts = inner.split(/(\[[^\]]*\])/);
    const rewritten = parts.map((part) => {
      // Skip anything that already IS a `[...]` escape — the user
      // wrote it explicitly, respect their choice verbatim.
      if (part.startsWith("[") && part.endsWith("]")) return part;
      // `(?<!\w)` before `@` avoids catching e-mail-shaped substrings.
      // The dot-adjacency check decides "reserved data-var" vs
      // "field-name-starting-with-@".
      return part.replace(
        /(?<!\w)@([\w-]+)/g,
        (match, name: string, offset: number) => {
          const before = part[offset - 1] ?? "";
          const after = part[offset + match.length] ?? "";
          const dotAdjacent = before === "." || after === ".";
          // Reserved data-var, standing alone → keep as-is so
          // Handlebars resolves its special meaning. Anything else
          // (dot-touched OR non-reserved) is a payload key — bracket-
          // escape it.
          if (HANDLEBARS_RESERVED.has(name) && !dotAdjacent) return match;
          return `[@${name}]`;
        },
      );
    });
    return "{{" + rewritten.join("") + "}}";
  });

  const template = Handlebars.compile(script);
  return template(payload);
};
