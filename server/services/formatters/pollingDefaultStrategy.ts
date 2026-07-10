// `PollingDefault` — the computed polling message: which watched fields
// verified the condition and their observed values. All the real logic
// lives in shared/polling/message.ts (it's also used by the wizard's
// bundle preview); this strategy is the thin adapter into the registry.

import { Formatting } from "#shared/types/bundle";
import { buildPollingDefaultMessage } from "#shared/polling/message";
import type { FormattingStrategy } from "./formattingStrategy";

export const pollingDefaultStrategy: FormattingStrategy = {
  formatting: Formatting.PollingDefault,

  render(alert, _bundle, payload) {
    return buildPollingDefaultMessage(alert, payload);
  },
};
  