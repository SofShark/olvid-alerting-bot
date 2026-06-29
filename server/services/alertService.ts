// Domain service for alerts.
//
// What lives here:
//   - Status computation rules (draft / inactive / active).
//   - "Can't activate an alert that has no bundles" rule.
//   - Any future cross-cutting rule (e.g. validation, audit logging).
//
// What does NOT live here:
//   - Raw Prisma calls         → alertRepository
//   - HTTP / route handling    → server/api/*
//   - Sending messages         → server/services/notifierService (rename of alertManager)
//
// The service orchestrates: it computes the right status, validates the
// inputs at the domain level, and delegates persistence to the repository.
// Testable without a database — pass a stubbed `alertRepository` in tests.

import { AlertStatus } from "#shared/types/alert";
import { alertRepository } from "../repositories/alertRepository";

// ── Status rules ────────────────────────────────────────────────────────────
//
// Rules (single source of truth):
//   - draft    : caller explicitly wants draft, OR no `input` selected.
//   - active   : caller wants active AND alert has ≥1 bundle.
//   - inactive : everything else with an `input`.
//
// The caller's intent comes from `requested` (the status value in the
// incoming payload). We map their intent against the constraints.
function computeStatus(
  input: any,
  bundleCount: number,
  requested?: string,
): AlertStatus {
  if (requested === AlertStatus.Draft) return AlertStatus.Draft;
  if (!input) return AlertStatus.Draft;
  if (requested === AlertStatus.Active && bundleCount > 0)
    return AlertStatus.Active;
  return AlertStatus.Inactive;
}

// ── Public API (drop-in surface for callers migrating off bdManager) ────────

export const alertService = {
  /**
   * Create an alert with the right status (per `computeStatus`).
   * Persistence is delegated to the repository.
   */
  async createAlert(data: any) {
    const bundleCount = Array.isArray(data.bundles) ? data.bundles.length : 0;
    const status = computeStatus(data.input, bundleCount, data.status);
    return await alertRepository.create({ ...data, status });
  },

  /**
   * Full update — recomputes status from the new input + bundle count.
   */
  async updateAlert(id: number, data: any) {
    const bundleCount = Array.isArray(data.bundles) ? data.bundles.length : 0;
    const status = computeStatus(data.input, bundleCount, data.status);
    return await alertRepository.update(id, { ...data, status });
  },

  /**
   * Status toggle (active ↔ inactive). Refuses to activate an alert that
   * has no bundles — that would be an alert that fires into the void.
   * Returns null if the alert doesn't exist.
   */
  async setStatus(id: number, requested: string) {
    const existing = await alertRepository.getById(id);
    if (!existing) return null;

    let finalStatus = requested as AlertStatus;
    if (
      requested === AlertStatus.Active &&
      (existing.bundles?.length ?? 0) === 0
    ) {
      // Can't activate without a destination — fall back to inactive silently.
      finalStatus = AlertStatus.Inactive;
    }

    return await alertRepository.setStatusRaw(id, finalStatus);
  },
};
