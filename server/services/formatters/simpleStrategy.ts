// `Simple` — title + description, no payload. The "just tell me it
// happened" format; the payload never reaches the message.

import { Formatting } from "#shared/types/bundle";
import type { FormattingStrategy } from "./formattingStrategy";

export const simpleStrategy: FormattingStrategy = {
  formatting: Formatting.Simple,

  render(alert, _bundle, _payload) {
    return `🚨 ${alert.title}\n${alert.description ?? ""}\n`;
  },
};
