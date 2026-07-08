<script setup lang="ts">
import { ref, computed } from "vue";
import {
  ConditionKind,
  ConditionOperator,
  ConditionAggregation,
  OPERATORS_NEEDING_VALUE,
  type PollingCondition,
} from "#shared/types/condition";
import { migrateCondition } from "#shared/condition/migrate";
import { expandPath, hasWildcard } from "#shared/condition/pathExpand";
import { conditionEvaluator } from "#shared/condition/conditionEvaluator";

/*
  Orchestrator for the polling condition editor. Owns the CONDITION
  state (`current`, derived kind/paths/operator/value/aggregation) and
  wires up the sub-components + composables that handle the details:

    · ConditionKindPicker  → radio between "no condition" and "rule".
    · WatchedFieldsPanel   → chips + inline "type a path" + picker button.
    · SourcePickerModal    → tree picker of the retrieved snapshot.
    · ConditionRuleRow     → aggregation + operator + value.
    · VerdictStrip (ui/)   → the "would fire?" preview strip.

  · useSourceRetrieve      → fetches the source snapshot (mount + watch).

  All this file does is glue: transport props/emits between the parent
  wizard, the sub-components, and the shared evaluator. Individual UI
  and IO concerns are extracted so each piece can be reasoned about in
  isolation — see the audit F-1 for the original 1142-line god
  component this replaces.
*/

const props = defineProps<{
  modelValue?: PollingCondition;
  url?: string;
  format?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: PollingCondition): void;
  (e: "update:payload", v: any): void;
}>();

const { t } = useI18n();

// ── Condition state (normalised on the way in) ────────────────────────────
const current = computed<PollingCondition>(() =>
  migrateCondition(props.modelValue),
);
const kind = computed(() => current.value.kind);
const paths = computed(() => current.value.paths);
const operator = computed(() => current.value.operator);
const literal = computed(() => current.value.value ?? "");
const aggregation = computed(() => current.value.aggregation);
const needsValue = computed(() => OPERATORS_NEEDING_VALUE.has(operator.value));

// ── Source retrieval (fetch + parse, auto on mount + url/format change) ──
const { loading, error, parsed, retrieved, rootEntries, retrieve } =
  useSourceRetrieve(
    () => props.url,
    () => props.format,
    (payload) => emit("update:payload", payload),
  );

// ── Effective paths (chips expanded against the current snapshot) ────────
// `paths` is what the user typed (may include wildcards).
// `effectivePaths` is the concrete leaf set they resolve to right now —
// used by the picker highlighting and the verdict summary.
const effectivePaths = computed<string[]>(() => {
  if (!parsed.value) {
    return [...new Set(paths.value.filter((p) => !hasWildcard(p)))];
  }
  const set = new Set<string>();
  for (const p of paths.value) {
    if (hasWildcard(p)) {
      for (const c of expandPath(p, parsed.value)) set.add(c);
    } else {
      set.add(p);
    }
  }
  return [...set];
});

// ── Emit helpers ─────────────────────────────────────────────────────────
/** Emit a merged condition with `kind: Rule` — used by any change that
 *  implicitly requires the rule branch (touching paths, operator, value). */
function patchRule(patch: Partial<PollingCondition>) {
  emit("update:modelValue", {
    ...current.value,
    ...patch,
    kind: ConditionKind.Rule,
  });
}

/** Flip kind without touching other fields. Preserves the user's
 *  in-progress selections when toggling None ⇄ Rule; compactCondition()
 *  at save time drops them if the final kind is None. */
function setKind(next: ConditionKind) {
  if (kind.value === next) return;
  emit("update:modelValue", { ...current.value, kind: next });
}

// ── Chip actions ─────────────────────────────────────────────────────────
function addPath(path: string) {
  if (paths.value.includes(path)) return;
  patchRule({ paths: [...paths.value, path] });
}

function removePath(path: string) {
  patchRule({ paths: paths.value.filter((p) => p !== path) });
}

/** Picker clicks. Three cases:
 *    (a) already a concrete chip → remove it.
 *    (b) covered by a wildcard chip → silent no-op (removing the leaf
 *        would have to break the wildcard, too destructive).
 *    (c) not on the list at all → add as a concrete chip. */
function toggleTreePath(path: string) {
  if (paths.value.includes(path)) {
    removePath(path);
    return;
  }
  if (effectivePaths.value.includes(path)) return;
  addPath(path);
}

// ── Picker modal state ───────────────────────────────────────────────────
const isPickerOpen = ref(false);

// ── Preview / verdict summary ────────────────────────────────────────────
/** Per-path verdicts for the current snapshot. Shared evaluator, same
 *  logic the server engine + polling-default message builder use.
 *  No baseline available client-side, so `Changed` shows as "would fire
 *  on next change" (evaluator preview default). */
const verdicts = computed(() => {
  if (!retrieved.value || paths.value.length === 0) return [];
  return conditionEvaluator.evaluate(current.value, parsed.value).verdicts;
});

/** Numeric reducers (Sum / Average / Min / Max) collapse everything into
 *  one synthetic verdict — the All / Any "X of Y fields" phrasing doesn't
 *  apply. */
const isNumericAgg = computed(
  () =>
    aggregation.value !== ConditionAggregation.All &&
    aggregation.value !== ConditionAggregation.Any,
);

const verdictSummary = computed(() => {
  if (kind.value === ConditionKind.None) {
    return { ok: true, label: t("conditionEditor.summary.firesEvery") };
  }
  if (paths.value.length === 0) {
    return { ok: false, label: t("conditionEditor.summary.noFields") };
  }
  if (retrieved.value && effectivePaths.value.length === 0) {
    return { ok: false, label: t("conditionEditor.summary.noMatch") };
  }
  if (operator.value === ConditionOperator.Changed) {
    const n = effectivePaths.value.length;
    return {
      ok: false,
      label:
        n === 1
          ? t("conditionEditor.summary.changedNeedsBaseline", { n })
          : t("conditionEditor.summary.changedNeedsBaselinePlural", { n }),
    };
  }
  if (needsValue.value && !literal.value) {
    return {
      ok: false,
      label: t("conditionEditor.summary.operatorNeedsValue", {
        operator: operator.value,
      }),
    };
  }
  if (!retrieved.value) {
    return { ok: false, label: t("conditionEditor.summary.waitingForSource") };
  }
  // Numeric aggregation: a single synthetic verdict carries the collapsed
  // value + comparison in its detail.
  if (isNumericAgg.value) {
    const v = verdicts.value[0];
    if (!v) {
      return { ok: false, label: t("conditionEditor.summary.waitingForSource") };
    }
    return {
      ok: v.fired,
      label: t(
        v.fired
          ? "conditionEditor.summary.wouldFireAgg"
          : "conditionEditor.summary.wouldNotFireAgg",
        { detail: v.detail },
      ),
    };
  }
  const fired =
    aggregation.value === ConditionAggregation.All
      ? verdicts.value.every((v) => v.fired)
      : verdicts.value.some((v) => v.fired);
  const passing = verdicts.value.filter((v) => v.fired).length;
  const total = verdicts.value.length;
  const isAll = aggregation.value === ConditionAggregation.All;
  const key = fired
    ? isAll
      ? total === 1
        ? "conditionEditor.summary.wouldFireAll"
        : "conditionEditor.summary.wouldFireAllPlural"
      : total === 1
        ? "conditionEditor.summary.wouldFireAny"
        : "conditionEditor.summary.wouldFireAnyPlural"
    : isAll
      ? total === 1
        ? "conditionEditor.summary.wouldNotFireRequiresAll"
        : "conditionEditor.summary.wouldNotFireRequiresAllPlural"
      : total === 1
        ? "conditionEditor.summary.wouldNotFireRequiresAny"
        : "conditionEditor.summary.wouldNotFireRequiresAnyPlural";
  return { ok: fired, label: t(key, { total, passing }) };
});
</script>

<template>
  <div class="cond-editor">
    <ConditionKindPicker
      :model-value="kind"
      @update:model-value="setKind"
    />

    <div v-if="kind === ConditionKind.Rule" class="cond-panel">
      <div class="cond-panel-head">
        {{ $t("conditionEditor.panel.title") }}
      </div>
      <div class="cond-panel-body">
        <WatchedFieldsPanel
          :paths="paths"
          :effective-count="effectivePaths.length"
          :parsed="parsed"
          @add-path="addPath"
          @remove-path="removePath"
          @open-picker="isPickerOpen = true"
        />

        <ConditionRuleRow
          :aggregation="aggregation"
          :operator="operator"
          :value="literal"
          @patch="patchRule"
        />
      </div>
    </div>

    <SourcePickerModal
      :open="isPickerOpen"
      :url="props.url"
      :format="props.format"
      :loading="loading"
      :error="error"
      :retrieved="retrieved"
      :root-entries="rootEntries"
      :effective-paths="effectivePaths"
      @close="isPickerOpen = false"
      @refresh="retrieve"
      @select="toggleTreePath"
    />

    <VerdictStrip :ok="verdictSummary.ok" :label="verdictSummary.label">
      <template
        v-if="kind === ConditionKind.Rule && verdicts.length > 0"
        #detail
      >
        <details>
          <summary>{{ $t("editor.testModal.perFieldBreakdown") }}</summary>
          <ul class="breakdown">
            <li
              v-for="v in verdicts"
              :key="v.path"
              :class="v.fired ? 'ok' : 'no'"
            >
              <code>{{ v.path }}</code> — {{ v.detail }}
            </li>
          </ul>
        </details>
      </template>
    </VerdictStrip>
  </div>
</template>

<style scoped>
.cond-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Condition panel — renamed from .panel to avoid clashing with the
 * global wizard/editor shell. Kept here (not in a sub-component)
 * because it wraps two children (WatchedFieldsPanel + ConditionRuleRow)
 * as a visual group. */
.cond-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.cond-panel-head {
  padding: var(--space-3) var(--space-5);
  background: var(--color-bg-card-soft);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.cond-panel-body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Per-path breakdown inside the verdict strip's `#detail` slot. */
.breakdown {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.breakdown li.ok {
  color: var(--color-success, #22c55e);
}
.breakdown li.no {
  color: var(--color-text-dim);
}
.breakdown code {
  color: var(--color-accent-text);
  background: var(--color-border-subtle);
  padding: 0 4px;
  border-radius: 3px;
}
</style>
