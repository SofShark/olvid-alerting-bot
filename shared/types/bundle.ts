// A Bundle is one output of an alert: 
// a list of delivery outputs + a formatting strategy. 
// An alert fires every one of its bundles in
// parallel; each produces its own message based on `formating` + script (if any).
//
// Discussion IDs are strings (JSON can't serialize bigint) and stay strings through Prisma's
// Json column — the Only place that promotes to bigint is the notifier,
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
export type MailOutputParams = { address: string, subject?: string };

/** One delivery target. Discriminated union on `type`. */
export type BundleOutput =
  | { type: typeof BundleOutputType.Olvid; params: OlvidOutputParams }
  | { type: typeof BundleOutputType.Mail; params: MailOutputParams };

// ── Bundle ──────────────────────────────────────────────────────────────

export const Formatting = {
  // Webhook-oriented options — work on the raw posted payload.
  WebhookRaw: "WebhookRaw",
  Simple: "Simple",
  Custom: "Custom",
  // Polling-oriented options — work on the parsed source + the alert's condition.
  PollingDefault: "PollingDefault",
  PollingCustom: "PollingCustom",
} as const;
export type Formatting = (typeof Formatting)[keyof typeof Formatting];

// Default format expected for each family.
export const DEFAULT_FORMAT_FOR_POLLING: Formatting = Formatting.PollingDefault;
export const DEFAULT_FORMAT_FOR_WEBHOOK: Formatting = Formatting.WebhookRaw;

export type BundleModel = {
  id?: number;
  name?: string;
  outputs: BundleOutput[];
  formating: Formatting;
  custom_script?: string;
  /** Mail only. Undefined => falls back to the alert's title at dispatch time. */
  mailSubject?: string;
};
