// JSON parser — trivial pass-through to JSON.parse. Same output shape
// as the XML/HTML parsers (JSON-like tree) so the condition evaluator
// and tree renderer don't need to care about the source format.

import { PollingFormat } from "#shared/types/polling";
import type { Parser, ParserContext, ParseResult } from "../types";

export const jsonParser: Parser = {
  format: PollingFormat.JSON,
  parse(ctx: ParserContext): ParseResult {
    const raw = ctx.raw ?? "";
    if (!raw.trim()) {
      return {
        raw,
        parsed: null,
        error: "Empty response body — nothing to parse.",
      };
    }
    // Cheap pre-check: JSON must start with "{" or "[" (or a primitive).
    // We accept the common object/array cases and fall through to
    // JSON.parse for the rest, letting it produce the real error.
    try {
      const parsed = JSON.parse(raw);
      return { raw, parsed };
    } catch (e: any) {
      console.error("[jsonParser] parse failed:", e);
      return { raw, parsed: null, error: e?.message ?? "JSON parse error" };
    }
  },
};
