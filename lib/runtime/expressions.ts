// ═══════════════════════════════════════════════════════════════
// Expression Parser & Evaluator
// Safely evaluates expressions like:
//   $user.name
//   $cart.total * 1.1
//   $user.role == 'admin'
//   $items.length > 0 && $user.isVerified
//
// Architecture: Source → Tokens → AST → Evaluate/Extract
// ═══════════════════════════════════════════════════════════════

// ── Token Types ──────────────────────────────────────────────

export enum TokenType {
  // Literals
  Number = "Number",
  String = "String",
  Boolean = "Boolean",
  Null = "Null",

  // Identifiers & state refs
  StateRef = "StateRef",       // $user.name
  Identifier = "Identifier",   // plain identifiers

  // Operators
  Plus = "+", Minus = "-", Star = "*", Slash = "/", Percent = "%",
  EqEq = "==", NotEq = "!=", Lt = "<", LtEq = "<=", Gt = ">", GtEq = ">=",
  And = "&&", Or = "||", Not = "!",
  Question = "?", Colon = ":",
  Dot = ".", LParen = "(", RParen = ")", LBracket = "[", RBracket = "]",
  Comma = ",", Pipe = "|",

  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ── AST Node Types ───────────────────────────────────────────

export type ASTNode =
  | LiteralNode
  | StateRefNode
  | UnaryNode
  | BinaryNode
  | TernaryNode
  | MemberNode
  | IndexNode
  | CallNode
  | PipeNode
  | ArrayNode;

export interface LiteralNode {
  kind: "literal";
  value: string | number | boolean | null;
}

export interface StateRefNode {
  kind: "stateRef";
  path: string; // "user.name", "cart.total"
  root: string; // "user", "cart" — the top-level state key
}

export interface UnaryNode {
  kind: "unary";
  op: "!" | "-";
  operand: ASTNode;
}

export interface BinaryNode {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||";
  left: ASTNode;
  right: ASTNode;
}

export interface TernaryNode {
  kind: "ternary";
  condition: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface MemberNode {
  kind: "member";
  object: ASTNode;
  property: string;
}

export interface IndexNode {
  kind: "index";
  object: ASTNode;
  index: ASTNode;
}

export interface CallNode {
  kind: "call";
  callee: string;
  args: ASTNode[];
}

export interface PipeNode {
  kind: "pipe";
  value: ASTNode;
  transform: string;
  args: ASTNode[];
}

export interface ArrayNode {
  kind: "array";
  elements: ASTNode[];
}

// ── Tokenizer ────────────────────────────────────────────────

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) { i++; continue; }

    const ch = source[i];
    const next = source[i + 1] || "";

    // State reference: $identifier.path.chain
    if (ch === "$") {
      const start = i;
      i++; // skip $
      let ref = "";
      while (i < source.length && /[a-zA-Z0-9_.]/.test(source[i])) {
        ref += source[i];
        i++;
      }
      if (!ref) throw new ExpressionError(`Empty state reference at position ${start}`, start);
      tokens.push({ type: TokenType.StateRef, value: ref, pos: start });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(next))) {
      const start = i;
      let num = "";
      while (i < source.length && /[0-9.]/.test(source[i])) { num += source[i]; i++; }
      tokens.push({ type: TokenType.Number, value: num, pos: start });
      continue;
    }

    // Strings (single or double quoted)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i++; // skip opening quote
      let str = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") { i++; str += source[i] || ""; }
        else { str += source[i]; }
        i++;
      }
      if (i >= source.length) throw new ExpressionError(`Unterminated string at position ${start}`, start);
      i++; // skip closing quote
      tokens.push({ type: TokenType.String, value: str, pos: start });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      let id = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) { id += source[i]; i++; }
      if (id === "true" || id === "false") {
        tokens.push({ type: TokenType.Boolean, value: id, pos: start });
      } else if (id === "null" || id === "undefined") {
        tokens.push({ type: TokenType.Null, value: id, pos: start });
      } else {
        tokens.push({ type: TokenType.Identifier, value: id, pos: start });
      }
      continue;
    }

    // Two-character operators
    const twoChar = ch + next;
    if (twoChar === "==" || twoChar === "!=" || twoChar === "<=" || twoChar === ">=" || twoChar === "&&" || twoChar === "||") {
      tokens.push({ type: twoChar as TokenType, value: twoChar, pos: i });
      i += 2;
      continue;
    }

    // Single-character operators
    const singleOps: Record<string, TokenType> = {
      "+": TokenType.Plus, "-": TokenType.Minus, "*": TokenType.Star,
      "/": TokenType.Slash, "%": TokenType.Percent,
      "<": TokenType.Lt, ">": TokenType.Gt, "!": TokenType.Not,
      "?": TokenType.Question, ":": TokenType.Colon,
      ".": TokenType.Dot, "(": TokenType.LParen, ")": TokenType.RParen,
      "[": TokenType.LBracket, "]": TokenType.RBracket,
      ",": TokenType.Comma, "|": TokenType.Pipe,
    };

    if (singleOps[ch]) {
      tokens.push({ type: singleOps[ch], value: ch, pos: i });
      i++;
      continue;
    }

    throw new ExpressionError(`Unexpected character '${ch}' at position ${i}`, i);
  }

  tokens.push({ type: TokenType.EOF, value: "", pos: i });
  return tokens;
}

// ── Parser (Recursive Descent) ───────────────────────────────

export function parse(source: string): ASTNode {
  const tokens = tokenize(source);
  let pos = 0;

  function peek(): Token { return tokens[pos]; }
  function advance(): Token { return tokens[pos++]; }
  function expect(type: TokenType): Token {
    const t = advance();
    if (t.type !== type) throw new ExpressionError(`Expected ${type} but got ${t.type} ('${t.value}')`, t.pos);
    return t;
  }

  // Precedence levels (lowest to highest):
  // ternary → or → and → equality → comparison → additive → multiplicative → unary → postfix → primary

  function parseTernary(): ASTNode {
    let node = parseOr();
    if (peek().type === TokenType.Question) {
      advance(); // skip ?
      const consequent = parseTernary();
      expect(TokenType.Colon);
      const alternate = parseTernary();
      node = { kind: "ternary", condition: node, consequent, alternate };
    }
    return node;
  }

  function parseOr(): ASTNode {
    let left = parseAnd();
    while (peek().type === TokenType.Or) {
      advance();
      left = { kind: "binary", op: "||", left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): ASTNode {
    let left = parseEquality();
    while (peek().type === TokenType.And) {
      advance();
      left = { kind: "binary", op: "&&", left, right: parseEquality() };
    }
    return left;
  }

  function parseEquality(): ASTNode {
    let left = parseComparison();
    while (peek().type === TokenType.EqEq || peek().type === TokenType.NotEq) {
      const op = advance().value as "==" | "!=";
      left = { kind: "binary", op, left, right: parseComparison() };
    }
    return left;
  }

  function parseComparison(): ASTNode {
    let left = parseAdditive();
    while ([TokenType.Lt, TokenType.LtEq, TokenType.Gt, TokenType.GtEq].includes(peek().type)) {
      const op = advance().value as "<" | "<=" | ">" | ">=";
      left = { kind: "binary", op, left, right: parseAdditive() };
    }
    return left;
  }

  function parseAdditive(): ASTNode {
    let left = parseMultiplicative();
    while (peek().type === TokenType.Plus || peek().type === TokenType.Minus) {
      const op = advance().value as "+" | "-";
      left = { kind: "binary", op, left, right: parseMultiplicative() };
    }
    return left;
  }

  function parseMultiplicative(): ASTNode {
    let left = parseUnary();
    while (peek().type === TokenType.Star || peek().type === TokenType.Slash || peek().type === TokenType.Percent) {
      const op = advance().value as "*" | "/" | "%";
      left = { kind: "binary", op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary(): ASTNode {
    if (peek().type === TokenType.Not) {
      advance();
      return { kind: "unary", op: "!", operand: parseUnary() };
    }
    if (peek().type === TokenType.Minus) {
      advance();
      return { kind: "unary", op: "-", operand: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix(): ASTNode {
    let node = parsePrimary();

    while (true) {
      if (peek().type === TokenType.Dot) {
        advance();
        const prop = expect(TokenType.Identifier);
        node = { kind: "member", object: node, property: prop.value };
      } else if (peek().type === TokenType.LBracket) {
        advance();
        const index = parseTernary();
        expect(TokenType.RBracket);
        node = { kind: "index", object: node, index };
      } else if (peek().type === TokenType.Pipe) {
        advance();
        const transform = expect(TokenType.Identifier);
        const args: ASTNode[] = [];
        if (peek().type === TokenType.Colon) {
          advance();
          args.push(parseTernary());
          while (peek().type === TokenType.Comma) { advance(); args.push(parseTernary()); }
        }
        node = { kind: "pipe", value: node, transform: transform.value, args };
      } else {
        break;
      }
    }

    return node;
  }

  function parsePrimary(): ASTNode {
    const t = peek();

    // State reference
    if (t.type === TokenType.StateRef) {
      advance();
      const parts = t.value.split(".");
      return { kind: "stateRef", path: t.value, root: parts[0] };
    }

    // Number literal
    if (t.type === TokenType.Number) {
      advance();
      return { kind: "literal", value: parseFloat(t.value) };
    }

    // String literal
    if (t.type === TokenType.String) {
      advance();
      return { kind: "literal", value: t.value };
    }

    // Boolean literal
    if (t.type === TokenType.Boolean) {
      advance();
      return { kind: "literal", value: t.value === "true" };
    }

    // Null
    if (t.type === TokenType.Null) {
      advance();
      return { kind: "literal", value: null };
    }

    // Function call: identifier(args)
    if (t.type === TokenType.Identifier && tokens[pos + 1]?.type === TokenType.LParen) {
      const name = advance().value;
      advance(); // skip (
      const args: ASTNode[] = [];
      if (peek().type !== TokenType.RParen) {
        args.push(parseTernary());
        while (peek().type === TokenType.Comma) { advance(); args.push(parseTernary()); }
      }
      expect(TokenType.RParen);
      return { kind: "call", callee: name, args };
    }

    // Plain identifier (treated as state ref without $)
    if (t.type === TokenType.Identifier) {
      advance();
      return { kind: "stateRef", path: t.value, root: t.value };
    }

    // Grouped expression
    if (t.type === TokenType.LParen) {
      advance();
      const node = parseTernary();
      expect(TokenType.RParen);
      return node;
    }

    // Array literal
    if (t.type === TokenType.LBracket) {
      advance();
      const elements: ASTNode[] = [];
      if (peek().type !== TokenType.RBracket) {
        elements.push(parseTernary());
        while (peek().type === TokenType.Comma) { advance(); elements.push(parseTernary()); }
      }
      expect(TokenType.RBracket);
      return { kind: "array", elements };
    }

    throw new ExpressionError(`Unexpected token '${t.value}' (${t.type}) at position ${t.pos}`, t.pos);
  }

  const ast = parseTernary();
  if (peek().type !== TokenType.EOF) {
    throw new ExpressionError(`Unexpected token '${peek().value}' after expression`, peek().pos);
  }
  return ast;
}

// ── Evaluator ────────────────────────────────────────────────

export type EvalContext = Record<string, unknown>;

/** Built-in functions available in expressions */
const BUILTIN_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  // Math
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  abs: (n) => Math.abs(Number(n)),
  round: (n) => Math.round(Number(n)),
  floor: (n) => Math.floor(Number(n)),
  ceil: (n) => Math.ceil(Number(n)),

  // String
  uppercase: (s) => String(s).toUpperCase(),
  lowercase: (s) => String(s).toLowerCase(),
  trim: (s) => String(s).trim(),
  length: (s) => (Array.isArray(s) ? s.length : String(s).length),
  includes: (s, search) => String(s).includes(String(search)),
  startsWith: (s, search) => String(s).startsWith(String(search)),
  endsWith: (s, search) => String(s).endsWith(String(search)),
  split: (s, sep) => String(s).split(String(sep)),
  join: (arr, sep) => (Array.isArray(arr) ? arr.join(String(sep ?? ",")) : ""),
  concat: (...args) => args.map(String).join(""),
  replace: (s, search, rep) => String(s).replace(String(search), String(rep)),
  substring: (s, start, end) => String(s).substring(Number(start), end != null ? Number(end) : undefined),

  // Type
  number: (v) => Number(v),
  string: (v) => String(v),
  boolean: (v) => Boolean(v),
  isNull: (v) => v == null,
  isArray: (v) => Array.isArray(v),
  typeof: (v) => typeof v,

  // Array
  first: (arr) => (Array.isArray(arr) ? arr[0] : undefined),
  last: (arr) => (Array.isArray(arr) ? arr[arr.length - 1] : undefined),
  count: (arr) => (Array.isArray(arr) ? arr.length : 0),
  reverse: (arr) => (Array.isArray(arr) ? [...arr].reverse() : arr),
  flat: (arr) => (Array.isArray(arr) ? arr.flat() : arr),
  keys: (obj) => (obj && typeof obj === "object" ? Object.keys(obj) : []),
  values: (obj) => (obj && typeof obj === "object" ? Object.values(obj) : []),

  // Date
  now: () => Date.now(),
  dateFormat: (ts, fmt) => {
    const d = new Date(Number(ts));
    if (fmt === "iso") return d.toISOString();
    if (fmt === "date") return d.toLocaleDateString();
    if (fmt === "time") return d.toLocaleTimeString();
    return d.toLocaleString();
  },

  // Misc
  json: (v) => JSON.stringify(v),
  parseJson: (s) => { try { return JSON.parse(String(s)); } catch { return null; } },
  defaultTo: (v, def) => v ?? def,
  coalesce: (...args) => args.find((a) => a != null),
};

/** Pipe transforms (value | transform:args) */
const PIPE_TRANSFORMS: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {
  uppercase: (v) => String(v).toUpperCase(),
  lowercase: (v) => String(v).toLowerCase(),
  trim: (v) => String(v).trim(),
  number: (v) => Number(v),
  string: (v) => String(v),
  round: (v, digits) => Number(Number(v).toFixed(Number(digits ?? 0))),
  currency: (v, curr) => new Intl.NumberFormat("en-US", { style: "currency", currency: String(curr ?? "USD") }).format(Number(v)),
  percent: (v) => `${(Number(v) * 100).toFixed(1)}%`,
  date: (v, fmt) => BUILTIN_FUNCTIONS.dateFormat(v, fmt),
  json: (v) => JSON.stringify(v, null, 2),
  default: (v, def) => v ?? def,
  truncate: (v, len) => { const s = String(v); const n = Number(len ?? 50); return s.length > n ? s.slice(0, n) + "…" : s; },
};

/** Resolve a dotted path on an object, safely */
function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (typeof current !== "object") return undefined;
    // Block prototype pollution
    if (part === "__proto__" || part === "constructor" || part === "prototype") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const MAX_EVAL_DEPTH = 64;

export function evaluate(node: ASTNode, context: EvalContext, depth = 0): unknown {
  if (depth > MAX_EVAL_DEPTH) throw new ExpressionError("Maximum expression depth exceeded", 0);

  switch (node.kind) {
    case "literal":
      return node.value;

    case "stateRef":
      return resolvePath(context, node.path);

    case "unary": {
      const val = evaluate(node.operand, context, depth + 1);
      if (node.op === "!") return !val;
      if (node.op === "-") return -Number(val);
      return val;
    }

    case "binary": {
      const left = evaluate(node.left, context, depth + 1);
      const right = evaluate(node.right, context, depth + 1);
      switch (node.op) {
        case "+": return typeof left === "string" || typeof right === "string" ? String(left) + String(right) : Number(left) + Number(right);
        case "-": return Number(left) - Number(right);
        case "*": return Number(left) * Number(right);
        case "/": { const d = Number(right); return d === 0 ? 0 : Number(left) / d; }
        case "%": { const d = Number(right); return d === 0 ? 0 : Number(left) % d; }
        case "==": return left == right;
        case "!=": return left != right;
        case "<": return Number(left) < Number(right);
        case "<=": return Number(left) <= Number(right);
        case ">": return Number(left) > Number(right);
        case ">=": return Number(left) >= Number(right);
        case "&&": return left && right;
        case "||": return left || right;
      }
      return undefined;
    }

    case "ternary": {
      const cond = evaluate(node.condition, context, depth + 1);
      return cond ? evaluate(node.consequent, context, depth + 1) : evaluate(node.alternate, context, depth + 1);
    }

    case "member": {
      const obj = evaluate(node.object, context, depth + 1);
      if (obj == null) return undefined;
      if (node.property === "__proto__" || node.property === "constructor" || node.property === "prototype") return undefined;
      return (obj as Record<string, unknown>)[node.property];
    }

    case "index": {
      const obj = evaluate(node.object, context, depth + 1);
      const idx = evaluate(node.index, context, depth + 1);
      if (obj == null || idx == null) return undefined;
      return (obj as Record<string | number, unknown>)[idx as string | number];
    }

    case "call": {
      const fn = BUILTIN_FUNCTIONS[node.callee];
      if (!fn) throw new ExpressionError(`Unknown function: ${node.callee}`, 0);
      const args = node.args.map((a) => evaluate(a, context, depth + 1));
      return fn(...args);
    }

    case "pipe": {
      const val = evaluate(node.value, context, depth + 1);
      const transform = PIPE_TRANSFORMS[node.transform];
      if (!transform) throw new ExpressionError(`Unknown pipe transform: ${node.transform}`, 0);
      const args = node.args.map((a) => evaluate(a, context, depth + 1));
      return transform(val, ...args);
    }

    case "array": {
      return node.elements.map((el) => evaluate(el, context, depth + 1));
    }
  }
}

// ── Dependency Extraction ────────────────────────────────────

/** Extract all $state references from an AST */
export function extractDependencies(node: ASTNode): Set<string> {
  const deps = new Set<string>();

  function walk(n: ASTNode): void {
    switch (n.kind) {
      case "stateRef":
        deps.add(n.root);
        break;
      case "unary":
        walk(n.operand);
        break;
      case "binary":
        walk(n.left);
        walk(n.right);
        break;
      case "ternary":
        walk(n.condition);
        walk(n.consequent);
        walk(n.alternate);
        break;
      case "member":
        walk(n.object);
        break;
      case "index":
        walk(n.object);
        walk(n.index);
        break;
      case "call":
        n.args.forEach(walk);
        break;
      case "pipe":
        walk(n.value);
        n.args.forEach(walk);
        break;
      case "array":
        n.elements.forEach(walk);
        break;
    }
  }

  walk(node);
  return deps;
}

/** Extract full dotted paths (e.g., "user.profile.name") */
export function extractFullPaths(node: ASTNode): Set<string> {
  const paths = new Set<string>();

  function walk(n: ASTNode): void {
    switch (n.kind) {
      case "stateRef":
        paths.add(n.path);
        break;
      case "unary": walk(n.operand); break;
      case "binary": walk(n.left); walk(n.right); break;
      case "ternary": walk(n.condition); walk(n.consequent); walk(n.alternate); break;
      case "member": walk(n.object); break;
      case "index": walk(n.object); walk(n.index); break;
      case "call": n.args.forEach(walk); break;
      case "pipe": walk(n.value); n.args.forEach(walk); break;
      case "array": n.elements.forEach(walk); break;
    }
  }

  walk(node);
  return paths;
}

// ── Convenience API ──────────────────────────────────────────

/** Parse and evaluate an expression in one call */
export function evalExpression(source: string, context: EvalContext): unknown {
  return evaluate(parse(source), context);
}

/** Check if a string looks like an expression (starts with $ or contains operators) */
export function isExpression(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("$") || /[+\-*/%<>=!&|?:]/.test(trimmed);
}

// ── Error Type ───────────────────────────────────────────────

export class ExpressionError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = "ExpressionError";
    this.position = position;
  }
}
