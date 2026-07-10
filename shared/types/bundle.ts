// One output of an alert: a list of destination discussions + a formatting
// strategy. An alert fires every one of its bundles in parallel; each
// produces its own message based on `formating`.

import type { DiscussionModel } from "./discussion";

export const Formatting = {
  // Webhook-oriented options — work on the raw posted payload.
  Unformatted: "Unformatted",
  Simple: "Simple",
  Custom: "Custom",
  // Polling-oriented options — work on the parsed source + the alert's condition.
  PollingDefault: "PollingDefault",
  PollingCustom: "PollingCustom",
} as const;
export type Formatting = (typeof Formatting)[keyof typeof Formatting];

// Default format expected for each trigger family. Used when seeding a
// new bundle so the dropdown lands on something sensible for the current
// alert's Source.
export const DEFAULT_FORMAT_FOR_POLLING: Formatting = Formatting.PollingDefault;
export const DEFAULT_FORMAT_FOR_WEBHOOK: Formatting = Formatting.Unformatted;

export type BundleModel = {
  id?: number;
  name?: string;
  discussion_list: DiscussionModel[];
  formating: Formatting;
  custom_script?: string;
};
