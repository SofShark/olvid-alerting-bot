// The full alert object as the frontend handles it.
//
// Two type-level decisions worth knowing:
//
// 1. `input` is strictly a `Source` value — no `| string` escape hatch. Any
//    legacy DB row that doesn't conform has to be normalised at the
//    boundary (Zod parser on the way out of the repo). Inside the app we
//    can trust the type.
//
// 2. `alertParams` is `AlertParams | undefined` — a single union built to
//    grow as more source types pick up per-alert config (Cron, Olvid
//    Message, …). Today it has one member (PollingParams). Webhook alerts
//    have no params at all; the field is simply absent for them.
//
//    No internal discriminator on the params (that would duplicate the
//    parent's `input` field). Narrowing is by the parent — use the
//    `getPollingParams(alert)` accessor below to avoid casts at every
//    read site. The moment a second member joins the union, every
//    `alert.alertParams.url`-style read becomes a TS error and the
//    accessor is the migration path.

import type { BundleModel } from "./bundle";
import type { PollingParams } from "./polling";
import type { MonitorParams } from "./monitor";
import { Source } from "./source";

export const AlertStatus = {
  Draft: "draft",
  Inactive: "inactive",
  Active: "active",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

/**
 * Union of all source-specific param shapes. Each Source value MAY
 * contribute one type here; sources without per-alert config (Webhook)
 * contribute nothing (undefined). Adding a new source is a one-line union extension.
 */
export type AlertParams = PollingParams | MonitorParams | undefined;

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
  /**
   * Source-specific config. Shape narrows by `input`:
   *   input === Source.Polling   ⇒ PollingParams
   *   input === Source.Webhook   ⇒ undefined (webhook alerts carry no params)
   * Prefer `getPollingParams(alert)` over `as PollingParams` at read sites.
   */
  alertParams?: AlertParams;
  bundles: BundleModel[];
};

/**
 * Safe typed accessor for the polling-specific params block. Returns
 * undefined when the alert isn't a polling alert OR has no params yet
 * (blank form). Keeps read sites free of `as PollingParams` casts and
 * future-proof against new AlertParams union members.
 */
export const getPollingParams = (
  alert: AlertModel | null | undefined,
): PollingParams | undefined =>
  alert?.input === Source.Polling
    ? (alert.alertParams as PollingParams | undefined)
    : undefined;

/**
 * Same as getPollingParams but for the Monitoring branch of the union.
 * Returns undefined when the alert isn't a monitoring alert or has no
 * params yet.
 */
export const getMonitorParams = (
  alert: AlertModel | null | undefined,
): MonitorParams | undefined =>
  alert?.input === Source.Monitoring
    ? (alert.alertParams as MonitorParams | undefined)
    : undefined;
