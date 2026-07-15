// Olvid chat markup helpers, isomorphic (browser + server).
//
// Olvid uses a small markdown-ish syntax for message formatting:
//   **bold**, _italic_, ~strike~, `code`
// See https://olvid.io/faq/format-your-messages/ for the source of truth.
//
// Two output modes:
//   · olvidMarkupToHtml     — HTML-escaped body with tags for a mail
//                             HTML preview or the `htmlbody` MailPace
//                             sends.
//   · olvidMarkupToPlainText — strips the markers; used for the mail
//                             `textbody` fallback so mail clients that
//                             opt out of HTML still get a readable
//                             message.
//
// The mail preview panel (client) and mailClient (server) both consume
// these helpers, so display + delivery stay in lockstep.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Escape first, then marker → tag rewrite, so a title containing
 *  `<script>` reaches the recipient (or the preview) as inert
 *  `&lt;script&gt;` rather than executable HTML. `_italic_` is guarded
 *  by word-boundary lookarounds so identifiers like `snake_case`
 *  don't accidentally italicise. */
export function olvidMarkupToHtml(body: string): string {
  return htmlEscape(body)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>")
    .replace(/~(.+?)~/g, "<s>$1</s>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

export function olvidMarkupToPlainText(body: string): string {
  return body
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1")
    .replace(/~(.+?)~/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
