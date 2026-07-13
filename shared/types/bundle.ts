// One output of an alert: a list of delivery outputs + a formatting
// strategy. An alert fires every one of its bundles in parallel; each
// produces its own message based on `formating`.
//
// `outputs` replaced the previous `discussion_list: DiscussionModel[]` shape:
// each row is now a type-tagged BundleFrontendOutput ({type, params}), which
// generalises beyond Olvid discussions to future channels (email, Slack, …).
// The server persists this as rows in the `BundleOutput` Prisma model.

import type { BundleFrontendOutput } from "./bundleOutput";

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
  outputs: BundleFrontendOutput[];
  formating: Formatting;
  custom_script?: string;
};
