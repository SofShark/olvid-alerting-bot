// Contract for a message-formatting strategy (Strategy pattern).
//
// Each Formatting enum value maps to one object implementing this
// interface. `notifierService` delegates body rendering to the strategy
// returned by `formatterFactory` — the per-format switch is gone.
//
// Strategies build the BODY only. The recovery prefix ("✓ RECOVERED:")
// is orthogonal to the format and stays in notifierService.formatMessage.
//
// `alert` / `bundle` / `payload` are intentionally loose (`any`): bundles
// arrive as Prisma rows and payloads are arbitrary webhook/parsed JSON —
// same contract the notifier has always had.

import type { Formatting } from "#shared/types/bundle";

export interface FormattingStrategy {
  /** The Formatting enum value this strategy renders. */
  readonly formatting: Formatting;

  /** Build the message body for one bundle fire. Must never throw —
   *  strategies with fallible internals (Handlebars) catch internally
   *  and return a fallback string. */
  render(alert: any, bundle: any, payload: any): string;
}
