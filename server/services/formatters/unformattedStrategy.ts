// `Unformatted` — raw payload dump inside a JSON code fence. Also the
// factory's fallback for unknown Formatting values, so a corrupt DB row
// still produces a readable (if ugly) message instead of nothing.

import { Formatting } from "#shared/types/bundle";
import type { FormattingStrategy } from "./formattingStrategy";

export const unformattedStrategy: FormattingStrategy = {
  formatting: Formatting.Unformatted,

  render(_alert, _bundle, payload) {
    return `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  },
};
