import { computed, type Ref, type WritableComputedRef } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel, AlertParams } from "#shared/types/alert";
import { PollingFormat, type PollingParams } from "#shared/types/polling";
import { TriggerMode } from "#shared/types/triggerMode";
import type { MonitorParams } from "#shared/types/monitor";
import { DEFAULT_SCHEDULE } from "#shared/polling/scheduler";
import { paramCleaner } from "~~/shared/condition/paramCleaner";

/**
 * v-model binding for the source picker. Reading is `form.input` verbatim.
 * Writing reconciles `form.alertParams` to the right shape for the picked
 * source:
 *
 *   - Polling    → seed a valid PollingParams (or restore the last set the
 *                  user had for Polling in this session).
 *   - Monitoring → seed a valid MonitorParams (or restore last set) with
 *                  `not-ok` as the default match.
 *   - Webhook    → `alertParams = undefined` (no per-alert config).
 *
 * Per-source stash: when the user flips sources mid-wizard, the outgoing
 * `alertParams` is snapshotted under the source it belonged to before
 * being replaced. Flipping back restores that snapshot — so
 * Polling(url+condition) → Monitoring → Polling brings the URL and
 * condition back verbatim, right up until the user hits Save.
 *
 * `undefined` represents the blank-form state (no source picked yet).
 */
export const useSourceBinding = (
  form: Ref<AlertModel>,
): WritableComputedRef<Source | undefined> => {
  // Wizard-lifetime stash. Keyed by Source. Untouched by save (a save is
  // a page transition; the composable is discarded with the wizard).
  const stash: Partial<Record<Source, AlertParams | undefined>> = {};

  return computed({
    get: () => form.value.input,
    set: (src) => {
      // Snapshot outgoing params under the OLD source before overwriting.
      const previousSrc = form.value.input;
      if (previousSrc && previousSrc !== src) {
        stash[previousSrc] = form.value.alertParams;
      }

      if (!src) {
        form.value.input = undefined;
        form.value.alertParams = undefined;
        return;
      }

      form.value.input = src;
      const restored = stash[src];

      if (src === Source.Polling) {
        // Restored takes precedence over the (now-stale) current params.
        const prev =
          (restored as PollingParams | undefined) ??
          (form.value.alertParams as PollingParams | undefined);
        form.value.alertParams = {
          url: prev?.url ?? "",
          format: prev?.format ?? PollingFormat.XML,
          schedule: prev?.schedule ?? DEFAULT_SCHEDULE,
          condition: prev?.condition ?? paramCleaner.blankCondition(),
          triggerMode: prev?.triggerMode ?? TriggerMode.EveryTime,
          datapointsN: prev?.datapointsN ?? 1,
          datapointsM: prev?.datapointsM ?? 1,
          // Preserve any runtime state the engine may have left behind.
          ...(prev?._baseline !== undefined
            ? { _baseline: prev._baseline }
            : {}),
          ...(prev?._lastHash !== undefined
            ? { _lastHash: prev._lastHash }
            : {}),
          ...(prev?._lastFired !== undefined
            ? { _lastFired: prev._lastFired }
            : {}),
          ...(prev?._lastPolledAt !== undefined
            ? { _lastPolledAt: prev._lastPolledAt }
            : {}),
        };
      } else if (src === Source.Monitoring) {
        const prev =
          (restored as MonitorParams | undefined) ??
          (form.value.alertParams as MonitorParams | undefined);
        form.value.alertParams = {
          url: prev?.url ?? "",
          schedule: prev?.schedule ?? DEFAULT_SCHEDULE,
          match: prev?.match ?? { kind: "not-ok" },
          triggerMode: prev?.triggerMode ?? TriggerMode.EveryTime,
          datapointsN: prev?.datapointsN ?? 1,
          datapointsM: prev?.datapointsM ?? 1,
          ...(prev?._lastStatus !== undefined
            ? { _lastStatus: prev._lastStatus }
            : {}),
          ...(prev?._lastFired !== undefined
            ? { _lastFired: prev._lastFired }
            : {}),
          ...(prev?._lastPolledAt !== undefined
            ? { _lastPolledAt: prev._lastPolledAt }
            : {}),
        };
      } else {
        // Webhook or unknown — no params. Restored value ignored
        // (Webhook has none).
        form.value.alertParams = undefined;
      }
    },
  });
};
