// Handlebars wrapper used to render bundle scripts both in preview
// (FormatEditor) and at runtime (notifierService).

import Handlebars from "handlebars"; // doc at https://handlebarsjs.com/


// Handlebars defines reserved names starting with @. 
// To avoid errors when data variables contain @ we bracked-escape them when
// they are classified as a fieldname so Handlebars treats it
// as a literal identifier instead of an unknown data-var. 
//
// Reserved names, acc. to the Handlebars docs:
//   @index, @key, @first, @last, @root, @level, @partial-block
const RESERVED = /^(?:index|key|first|last|root|level|partial-block)$/;

export const formatMessage = (script: string, payload: unknown): string => {
  // Rewrite only inside `{{ ... }}` — the surrounding prose is left
  // Inside each mustache, match `@name` tokens that aren't
  // already inside a `[bracket-escape]` (lookbehind on `[` and `\w`).
  // Bare reserved names survive; everything else gets wrapped.
  script = script.replace(/{{([\s\S]*?)}}/g, (_full, inner: string) => {
    const rewritten = inner.replace(
      /(?<![\w[])@([\w-]+)/g,
      (match: string, name: string, offset: number) => {
        const before = inner[offset - 1] ?? "";
        const after = inner[offset + match.length] ?? "";
        const bare = before !== "." && after !== ".";
        return RESERVED.test(name) && bare ? match : `[${match}]`;
      },
    );
    return "{{" + rewritten + "}}";
  });

  return Handlebars.compile(script)(payload);
};
