/**
 * Output of a bundle — one delivery target of one type. Extensible to
 * additional channels later (email, Slack, Discord, …); today only
 * "olvid" is supported.
 *
 * Two shapes live in this file:
 *   · BundleOutputModel  — server-side in-memory. Uses `bigint` for
 *                          Olvid discussion IDs so it feeds
 *                          `olvidClient.sendMessage(bigint[])` without
 *                          re-coercion.
 *   · BundleFrontendOutput — wire + frontend. Same shape but with
 *                            `discussionId: string`, because JSON.stringify
 *                            can't serialize bigints. Prisma's `Json` column
 *                            also stores this string form on disk.
 *
 * The repo layer (`alertRepository.serializeBundle` / `buildOutputs`) is
 * the ONE place that converts between the two.
 */

export const BundleOutputType = {
  Olvid: "olvid",
} as const;
export type BundleOutputType = (typeof BundleOutputType)[keyof typeof BundleOutputType];

/** Server-side params, one variant per type. */
export type OlvidOutputParams = { discussionId: bigint }; // future: | EmailOutputParams | ...

/** Server-side in-memory model. */
export type BundleOutputModel = {
  type: BundleOutputType;
  params: OlvidOutputParams; // future: | EmailOutputParams | ...
};

/** Wire/frontend params — JSON-safe (bigint stringified). */
export type OlvidOutputParamsWire = { discussionId: string };

/** Wire/frontend model — what the API returns and the frontend v-models. */
export type BundleFrontendOutput = {
  type: BundleOutputType;
  params: OlvidOutputParamsWire; // future: | EmailOutputParamsWire | ...
};
