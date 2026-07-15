// Default polling message builder. Used by:
//   - BundleCard      (preview of what will be sent on fire)
//   - notifierService (actual message generation on the server)
//
// Pure: no IO, no DOM. Safe in both Nuxt server and browser contexts.
// All evaluation logic lives in shared/condition/conditionEvaluator.ts —
// this module only formats the resulting verdicts into a Telegram-
// friendly string.

import { ConditionKind, ConditionOperator } from "../types/condition";
import { conditionEvaluator } from "../condition/conditionEvaluator";

function asText(v: any): string {
  if (v === null || v === undefined) return "(no value)";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function lineFor(
  operator: ConditionOperator,
  path: string,
  threshold: string | undefined,
  observed: any,
): string {
  switch (operator) {
    case ConditionOperator.Changed:
      return `${path} → ${asText(observed)}  (changed)`;
    case ConditionOperator.Equals:
      return `${path} = ${asText(observed)}  (= "${asText(threshold)}")`;
    case ConditionOperator.GreaterThan:
      return `${path} = ${asText(observed)}  (> ${asText(threshold)})`;
    case ConditionOperator.LessThan:
      return `${path} = ${asText(observed)}  (< ${asText(threshold)})`;
    case ConditionOperator.Contains:
      return `${path} = "${asText(observed)}"  (contains "${asText(threshold)}")`;
    case ConditionOperator.RegExp:
      return `${path} = "${asText(observed)}"  (matches /${asText(threshold)}/)`;
    default:
      return `${path}: ${asText(observed)}`;
  }
}

/**
 * Build the polling-default message for an alert + observed payload.
 *
 * @param alert    At minimum: { title, description?, alertParams?.condition }.
 * @param payload  The parsed source object (for XML this is the parsed tree).
 * @param baseline Optional previous-poll snapshot — pass on the server for
 *                 accurate `changed` evaluation. Omit in previews; the
 *                 evaluator treats "no baseline" as "would fire on next change".
 */
export function buildPollingDefaultMessage(
  alert: any,
  payload: any,
  baseline?: any,
): string {
  const title = alert?.title ?? "Polling alert";
  const cond = alert?.alertParams?.condition;
  const result = conditionEvaluator.evaluate(cond, payload, baseline);

  // `**title**` is Olvid's bold marker; mailClient strips it before send
  // so mail readers see plain title. 
  const header = `📡 **${title}**`;

  if (result.kind === ConditionKind.None) {
    return `${header}\nPolled successfully (no condition — fires every cycle).`;
  }
  if (result.verdicts.length === 0) {
    // Empty paths / missing value / etc. — evaluator already encoded the why.
    return `${header}\n${result.reason}`;
  }

  const fired = result.verdicts.filter((v) => v.fired);
  if (fired.length === 0) {
    // Useful in previews: tells the user "your rule would not fire on the
    // current snapshot".
    return `${header}\nNo watched fields currently verify the condition on this snapshot.`;
  }

  const lines = fired.map(
    (v) =>
      `• ${lineFor(result.condition.operator, v.path, result.condition.value, v.observed)}`,
  );
  return `${header}\n${lines.join("\n")}`;
}
