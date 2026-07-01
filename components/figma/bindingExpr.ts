// ═══════════════════════════════════════════════════════════════
// Text template → runtime expression compiler.
//
// Inline data tokens are written as @path inside a text layer, e.g.
//   "Welcome back, @user.username!"
// The runtime binds a layer's `text` to a single expression, so we
// compile the template into a string-concatenation expression the
// engine evaluates (lib/runtime/expressions.ts):
//   'Welcome back, ' + $user.username + '!'
//
// The raw template stays in layer.text so it round-trips on re-edit;
// the compiled expression is stored in layer.bindings.text.
// ═══════════════════════════════════════════════════════════════

// Token: @ followed by a state path (identifier, then .prop / [idx] chars).
const TOKEN_RE = /@([A-Za-z_][A-Za-z0-9_.]*)/g;

/** Single-quoted string literal with safe escaping for the expression engine. */
function lit(s: string): string {
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

/**
 * Compile a text template containing @tokens into a runtime expression.
 * Returns null when the template has no tokens (caller should clear the
 * binding and fall back to the static text).
 */
export function compileTextTemplate(text: string): string | null {
  TOKEN_RE.lastIndex = 0;
  if (!TOKEN_RE.test(text)) return null;

  TOKEN_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(lit(text.slice(last, m.index)));
    parts.push("$" + m[1]); // @user.name → $user.name
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(lit(text.slice(last)));
  return parts.length ? parts.join(" + ") : null;
}

/** A picker path ($user.name) → an inline token (@user.name). */
export function pathToToken(path: string): string {
  return "@" + path.replace(/^\$/, "");
}
