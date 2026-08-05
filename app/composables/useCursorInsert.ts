import { nextTick } from "vue";

/**
 * Imperative textarea cursor helper. Inserts text at the caret (replacing
 * any selection), then restores focus and places the caret right after
 * the inserted text. Falls back to appending when no textarea is mounted.
 *
 * `pathToHandlebars` converts a dot-path with array indices into Handlebars
 * syntax: `commits.0.author.name` → `commits.[0].author.name`. `onPathSelect`
 * is the convenience handler used by the JSON / XML tree panels — it wraps
 * the converted path in `{{ }}` and pipes it through `insertAtCursor`.
 *
 * Takes getters (not refs) so the composable doesn't care whether the
 * textarea lives in the same component, a child via `defineExpose`, or
 * anywhere else — the caller decides how to resolve it at call time.
 */
export const useCursorInsert = (
  getTextarea: () => HTMLTextAreaElement | null,
  getScript: () => string,
  setScript: (v: string) => void,
) => {
  // Convert a dot-path with array indices into Handlebars syntax. Two
  // segments need bracket-escaping so Handlebars parses them literally
  // instead of treating them as special tokens:
  //   - numeric indices (`0`, `1`, …) — the docs' recommended form.
  //   - segments starting with a character Handlebars would otherwise
  //     interpret (`#` opens a block, `@` is a data-variable prefix,
  //     `/` closes a block, `>` is a partial). fast-xml-parser emits
  //     `#text` for the text child of an element that also has attrs;
  //     without escaping, `{{foo.#text}}` fails to compile.
  const pathToHandlebars = (path: string): string =>
    path
      .split(".")
      .map((seg) =>
        /^\d+$/.test(seg) || /^[#@/>]/.test(seg) ? `[${seg}]` : seg,
      )
      .join(".");

  const insertAtCursor = (text: string) => {
    const ta = getTextarea();
    if (!ta) {
      setScript(getScript() + text);
      return;
    }
    const script = getScript();
    const start = ta.selectionStart ?? script.length;
    const end = ta.selectionEnd ?? script.length;
    setScript(script.slice(0, start) + text + script.slice(end));
    nextTick(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  };

  const onPathSelect = (path: string) => {
    insertAtCursor(`{{${pathToHandlebars(path)}}}`);
  };

  return { insertAtCursor, onPathSelect, pathToHandlebars };
};
