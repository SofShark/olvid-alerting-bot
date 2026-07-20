/**
 * Output of a bundle — one delivery target of one type. Extensible to
 * additional channels (Slack, Discord, …) via the `type` discriminator.
 * Currently supported: "olvid" (message to an Olvid discussion), "mail"
 * (SMTP email to a single address).
 *
 * Two shapes live in this file:
 *   · BundleOutputModel  — server-side in-memory. Uses `bigint` for
 *                          Olvid discussion IDs so it feeds
 *                          `olvidClient.sendMessage(bigint[])` without
 *                          re-coercion. Mail params have no bigint, so
 *                          the mail variant is identical on both sides.
 *   · BundleFrontendOutput — wire + frontend. Same shape but with
 *                            `discussionId: string`, because JSON.stringify
 *                            can't serialize bigints. Prisma's `Json` column
 *                            also stores this string form on disk.
 *
 * Both models are discriminated unions on `type` so `.filter(o => o.type
 * === "…")` narrows `params` without a cast at the call site.
 *
 * The repo layer (`alertOutputRepository.serializeOutput` / `buildOutputsCreate`)
 * is the ONE place that converts between the two.
 */

export const BundleOutputType = {
  Olvid: "olvid",
  Mail: "mail",
} as const;
export type BundleOutputType =
  (typeof BundleOutputType)[keyof typeof BundleOutputType];

/** Server-side params, one variant per type. */
export type OlvidOutputParams = { discussionId: bigint };
export type MailOutputParams = { address: string };

/** Server-side in-memory model — discriminated on `type`. */
export type BundleOutputModel =
  | { type: typeof BundleOutputType.Olvid; params: OlvidOutputParams }
  | { type: typeof BundleOutputType.Mail; params: MailOutputParams };

/** Wire/frontend params — JSON-safe (bigint stringified). Mail has no
 *  bigint, so its wire form matches its server form. */
export type OlvidOutputParamsWire = { discussionId: string };
export type MailOutputParamsWire = MailOutputParams;

/** Wire/frontend model — what the API returns and the frontend v-models. */
export type BundleFrontendOutput =
  | { type: typeof BundleOutputType.Olvid; params: OlvidOutputParamsWire }
  | { type: typeof BundleOutputType.Mail; params: MailOutputParamsWire };
