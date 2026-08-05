// A Bundle is one output of an alert: a list of delivery outputs +
// a formatting strategy. An alert fires every one of its bundles in
// parallel; each produces its own message based on `formating`.
//
// `outputs` is a list of `BundleOutput` — each row a type-tagged
// { type, params } that generalises beyond Olvid discussions to future
// channels (mail, and later Slack/Discord/…). Discriminated on `type`,
// so `.filter(o => o.type === "olvid")` narrows `params` at read sites.
//
// One façade, wire-shaped everywhere. Discussion IDs are strings on the
// wire (JSON can't serialize bigint) and stay strings through Prisma's
// Json column — the ONE place that promotes to bigint is the notifier,
// right before calling `olvidClient.sendMessage(bigint[])`.

// ── BundleOutput ────────────────────────────────────────────────────────

export const BundleOutputType = {
  Olvid: "olvid",
  Mail: "mail",
} as const;
export type BundleOutputType =
  (typeof BundleOutputType)[keyof typeof BundleOutputType];

/** Per-channel params. Discussion id stringified (JSON has no bigint). */
export type OlvidOutputParams = { discussionId: string };
export type MailOutputParams = { address: string };

/** One delivery target. Discriminated union on `type` — the shared
 *  façade used by the client, the API, the repository (which persists
 *  it as JSON), and the notifier (which coerces the id at the boundary). */
export type BundleOutput =
  | { type: typeof BundleOutputType.Olvid; params: OlvidOutputParams }
  | { type: typeof BundleOutputType.Mail; params: MailOutputParams };

// ── Bundle ──────────────────────────────────────────────────────────────

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
  outputs: BundleOutput[];
  formating: Formatting;
  custom_script?: string;
};
