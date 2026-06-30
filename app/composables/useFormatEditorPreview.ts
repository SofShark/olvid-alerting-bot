import { computed, type Ref } from "vue";
import { formatMessage } from "#shared/handlebars";

/**
 * Live preview of the Handlebars script run against the current payload.
 *
 * Two error surfaces handled here:
 *   - JSON parse error (only for the webhook path — the polling path
 *     uses `parsedTree` directly, which is already an object).
 *   - Handlebars render error (any path).
 *
 * The output text gets a tiny markdown-lite pass (`**bold**` → <strong>,
 * `\n-` → `\n•`) so the chat-bubble preview matches what Olvid renders.
 *
 * Returned shape `{ text, error }` is what the bubble vs error-bubble
 * branch in PreviewPanel switches on.
 */
export const useFormatEditorPreview = (opts: {
  scriptContent: Ref<string>;
  isPolling: Ref<boolean>;
  parsedTree: Ref<unknown>;
  jsonPayload: Ref<string>;
}) => {
  const { t } = useI18n();

  const previewData = computed<{ text: string; error: string | null }>(() => {
    const script = opts.scriptContent.value;
    if (!script || script.trim() === "") {
      return { text: t("formatEditor.preview.placeholder"), error: null };
    }

    let context: unknown;
    if (opts.isPolling.value) {
      context = opts.parsedTree.value ?? {};
    } else {
      try {
        context = JSON.parse(opts.jsonPayload.value);
      } catch (err) {
        return {
          text: "",
          error: t("formatEditor.errors.jsonError", {
            message: (err as Error).message,
          }),
        };
      }
    }

    try {
      const msg = formatMessage(script, context);
      return {
        text: msg
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n-/g, "\n•"),
        error: null,
      };
    } catch (err) {
      return {
        text: "",
        error: t("formatEditor.errors.handlebarsError", {
          message: (err as Error).message,
        }),
      };
    }
  });

  return { previewData };
};
