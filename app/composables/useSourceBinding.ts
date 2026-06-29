import { computed, type Ref, type WritableComputedRef } from "vue";
import { Source } from "#shared/types/source";
import type { AlertModel } from "#shared/types/alert";
import { PollingFormat } from "#shared/types/polling";
import { blankCondition } from "#shared/condition/migrate";

/**
 * v-model binding for the source picker. Reading is `form.input` verbatim.
 * Writing reconciles `form.alertParams` to the right shape for the picked
 * source:
 *
 *   - Polling → seed a valid PollingParams (or preserve existing fields).
 *               `blankCondition()` ensures `condition` always satisfies the
 *               PollingCondition type even before the user picks a rule.
 *   - Webhook (or any future non-polling source) → `alertParams = undefined`.
 *               Webhook alerts have no per-alert config — the field is absent.
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
        const prev = form.value.alertParams;
        form.value.alertParams = {
          url: prev?.url ?? "",
          format: prev?.format ?? PollingFormat.XML,
          intervalSeconds: prev?.intervalSeconds ?? 300,
          condition: prev?.condition ?? blankCondition(),
          // Preserve any runtime state the engine may have left behind.
          ...(prev?._baseline !== undefined
            ? { _baseline: prev._baseline }
            : {}),
          ...(prev?._lastHash !== undefined
            ? { _lastHash: prev._lastHash }
            : {}),
        };
      } else {
        form.value.alertParams = undefined;
      }
    },
  });
