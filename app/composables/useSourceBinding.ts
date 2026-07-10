import { computed, type Ref, type WritableComputedRef } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import {
  PollingFormat,
  TriggerMode,
  type PollingParams,
} from "#shared/types/polling";
import type { MonitorParams } from "#shared/types/monitor";
import { DEFAULT_SCHEDULE } from "#shared/polling/scheduler";
import { blankCondition } from "#shared/condition/migrate";

/**
 * v-model binding for the source picker. Reading is `form.input` verbatim.
 * Writing reconciles `form.alertParams` to the right shape for the picked
 * source:
 *
 *   - Polling    → seed a valid PollingParams (or preserve existing fields).
 *                  `blankCondition()` ensures `condition` always satisfies
 *                  the PollingCondition type even before the user picks a
 *                  rule.
 *   - Monitoring → seed a valid MonitorParams with `not-ok` as the default
 *                  match (most common "endpoint is broken" case).
 *   - Webhook    → `alertParams = undefined`. Webhook alerts have no
 *                  per-alert config — the field is absent.
 *
 * The empty string represents the blank-form state (no source picked yet).
 */
export const useSourceBinding = (
  form: Ref<AlertModel>,
): WritableComputedRef<string> =>
  computed({
    get: () => form.value.input,
    set: (src) => {
      if (!src) {
        form.value.input = "";
        form.value.alertParams = undefined;
        return;
      }
      form.value.input = src as Source;
      if (src === Source.Polling) {
        const prev = form.value.alertParams as PollingParams | undefined;
        form.value.alertParams = {
          url: prev?.url ?? "",
          format: prev?.format ?? PollingFormat.XML,
          schedule: prev?.schedule ?? DEFAULT_SCHEDULE,
          condition: prev?.condition ?? blankCondition(),
          triggerMode: prev?.triggerMode ?? TriggerMode.EveryTime,
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
        const prev = form.value.alertParams as MonitorParams | undefined;
        form.value.alertParams = {
          url: prev?.url ?? "",
          schedule: prev?.schedule ?? DEFAULT_SCHEDULE,
          match: prev?.match ?? { kind: "not-ok" },
          triggerMode: prev?.triggerMode ?? TriggerMode.EveryTime,
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
        form.value.alertParams = undefined;
      }
    },
  });
