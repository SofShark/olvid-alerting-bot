// The full alert object as the frontend handles it.
//
// Two type-level decisions worth knowing:
//
// 1. `input` is strictly a `Source` value — no `| string` escape hatch. Any
//    legacy DB row that doesn't conform has to be normalised at the
//    boundary (Zod parser on the way out of the repo). Inside the app we
//    can trust the type.
//
// 2. `alertParams` is `PollingParams | undefined` (via `?:`), NOT a union
//    of `PollingParams | WebhookParams`. Webhook alerts have no params at
//    all — the field is simply absent. This eliminates the union-of-
//    differently-shaped-objects that had the rest of the codebase doing
//    `(form.alertParams as any).url` all over the place.
//    The parent's `input` field tells you which case you're in:
//      if (alert.input === Source.Polling) { alert.alertParams.url ... }

import type { BundleModel } from "./bundle";
import type { PollingParams } from "./polling";
import type { Source } from "./source";

export const AlertStatus = {
  Draft: "draft",
  Inactive: "inactive",
  Active: "active",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export type AlertModel = {
  id: number | null;
  title: string;
  description: string;
  /**
   * Source value, OR empty string for the blank-form initial state
   * (user hasn't picked a source yet). We could use `?:` and undefined,
   * but the existing code treats "no source" as `''` consistently and
   * checks `!form.input` — keeping `''` as the sentinel is the
   * minimum-change path.
   */
  input: Source | "";
  status: AlertStatus;
  token: string;
  alertParams?: PollingParams; // present iff input === Source.Polling
  bundles: BundleModel[];
};
