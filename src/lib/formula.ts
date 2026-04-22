// Formula parser and evaluator for database computed columns.
// Supports arithmetic, string concatenation, comparisons, logical operators,
// conditionals (if), property references (prop), and built-in functions.

// ---------------------------------------------------------------------------
// AST node types
// ---------------------------------------------------------------------------

export type ASTNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "binary"; op: BinaryOp; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: "!" | "-"; operand: ASTNode }
  | { type: "call"; name: string; args: ASTNode[] }
  | { type: "prop"; name: string }
  | { type: "if"; condition: ASTNode; then: ASTNode; else: ASTNode };

type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "&&"
  | "||";

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | "number"
  | "string"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATORS = [
  "&&",
  "||",
  "==",
  "!=",
  ">=",
  "<=",
  ">",
  "<",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
] as const;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // String literal (double-quoted)
    if (ch === '"') {
      const start = i;
      i++; // skip opening quote
      let str = "";
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          str += input[i];
        } else {
          str += input[i];
        }
        i++;
      }
      if (i >= input.length) {
        throw new FormulaError(`Unterminated string at position ${start}`);
      }
      i++; // skip closing quote
      tokens.push({ type: "string", value: str, pos: start });
      continue;
    }

    // Number literal
    if (ch >= "0" && ch <= "9") {
      const start = i;
      while (i < input.length && ((input[i] >= "0" && input[i] <= "9") || input[i] === ".")) {
        i++;
      }
      tokens.push({ type: "number", value: input.slice(start, i), pos: start });
      continue;
    }

    // Parentheses and comma
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")", pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ",", pos: i });
      i++;
      continue;
    }

    // Operators (try two-char first, then one-char)
    let matched = false;
    for (const op of OPERATORS) {
      if (input.startsWith(op, i)) {
        tokens.push({ type: "op", value: op, pos: i });
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Identifier (function name, keyword, or bare word)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = i;
      while (
        i < input.length &&
        ((input[i] >= "a" && input[i] <= "z") ||
          (input[i] >= "A" && input[i] <= "Z") ||
          (input[i] >= "0" && input[i] <= "9") ||
          input[i] === "_")
      ) {
        i++;
      }
      tokens.push({ type: "ident", value: input.slice(start, i), pos: start });
      continue;
    }

    throw new FormulaError(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ type: "eof", value: "", pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser — recursive descent
// ---------------------------------------------------------------------------

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new FormulaError(
        `Expected ${value ?? type} at position ${token.pos}, got '${token.value}'`,
      );
    }
    return this.advance();
  }

  parse(): ASTNode {
    const node = this.parseOr();
    if (this.peek().type !== "eof") {
      throw new FormulaError(
        `Unexpected token '${this.peek().value}' at position ${this.peek().pos}`,
      );
    }
    return node;
  }

  // Precedence (low to high): || → && → == != → < > <= >= → + - → * / % → unary → primary

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.peek().type === "op" && this.peek().value === "||") {
      this.advance();
      const right = this.parseAnd();
      left = { type: "binary", op: "||", left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.peek().type === "op" && this.peek().value === "&&") {
      this.advance();
      const right = this.parseEquality();
      left = { type: "binary", op: "&&", left, right };
    }
    return left;
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "==" || this.peek().value === "!=")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseComparison();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    while (
      this.peek().type === "op" &&
      (this.peek().value === ">" ||
        this.peek().value === "<" ||
        this.peek().value === ">=" ||
        this.peek().value === "<=")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseAdditive();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseMultiplicative();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "*" ||
        this.peek().value === "/" ||
        this.peek().value === "%")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseUnary();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.peek().type === "op" && this.peek().value === "!") {
      this.advance();
      const operand = this.parseUnary();
      return { type: "unary", op: "!", operand };
    }
    if (this.peek().type === "op" && this.peek().value === "-") {
      this.advance();
      const operand = this.parseUnary();
      return { type: "unary", op: "-", operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    // Number literal
    if (token.type === "number") {
      this.advance();
      return { type: "number", value: Number(token.value) };
    }

    // String literal
    if (token.type === "string") {
      this.advance();
      return { type: "string", value: token.value };
    }

    // Parenthesized expression
    if (token.type === "lparen") {
      this.advance();
      const expr = this.parseOr();
      this.expect("rparen");
      return expr;
    }

    // Identifier: keyword, function call, or boolean
    if (token.type === "ident") {
      const name = token.value;

      // Boolean literals
      if (name === "true") {
        this.advance();
        return { type: "boolean", value: true };
      }
      if (name === "false") {
        this.advance();
        return { type: "boolean", value: false };
      }

      // if(condition, then, else)
      if (name === "if") {
        this.advance();
        this.expect("lparen");
        const condition = this.parseOr();
        this.expect("comma", ",");
        const thenBranch = this.parseOr();
        this.expect("comma", ",");
        const elseBranch = this.parseOr();
        this.expect("rparen");
        return { type: "if", condition, then: thenBranch, else: elseBranch };
      }

      // prop("Name")
      if (name === "prop") {
        this.advance();
        this.expect("lparen");
        const nameToken = this.expect("string");
        this.expect("rparen");
        return { type: "prop", name: nameToken.value };
      }

      // Generic function call: name(arg1, arg2, ...)
      this.advance();
      if (this.peek().type === "lparen") {
        this.advance();
        const args: ASTNode[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseOr());
          while (this.peek().type === "comma") {
            this.advance();
            args.push(this.parseOr());
          }
        }
        this.expect("rparen");
        return { type: "call", name, args };
      }

      // Bare identifier — treat as an error
      throw new FormulaError(
        `Unknown identifier '${name}' at position ${token.pos}`,
      );
    }

    throw new FormulaError(
      `Unexpected token '${token.value}' at position ${token.pos}`,
    );
  }
}

/** Parse a formula expression string into an AST. Throws FormulaError on invalid input. */
export function parseFormula(expression: string): ASTNode {
  if (!expression.trim()) {
    throw new FormulaError("Empty expression");
  }
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/** Context for evaluating a formula against a specific row. */
export interface FormulaContext {
  /** Look up a property value by property name. Returns the raw value from row_values. */
  getPropertyValue: (propertyName: string) => FormulaValue;
  /** Look up a property definition by name (needed for recursive formula evaluation). */
  getPropertyByName: (propertyName: string) => { type: string; config: Record<string, unknown> } | undefined;
}

export type FormulaValue = string | number | boolean | Date | null;

const BUILTIN_FUNCTIONS: Record<
  string,
  (args: FormulaValue[]) => FormulaValue
> = {
  now: () => new Date(),

  length: (args) => {
    const val = args[0];
    if (typeof val === "string") return val.length;
    return 0;
  },

  round: (args) => {
    const num = toNumber(args[0]);
    const decimals = args.length > 1 ? toNumber(args[1]) : 0;
    if (isNaN(num) || isNaN(decimals)) return NaN;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  floor: (args) => {
    const num = toNumber(args[0]);
    return Math.floor(num);
  },

  ceil: (args) => {
    const num = toNumber(args[0]);
    return Math.ceil(num);
  },

  abs: (args) => {
    const num = toNumber(args[0]);
    return Math.abs(num);
  },

  min: (args) => {
    const a = toNumber(args[0]);
    const b = toNumber(args[1]);
    return Math.min(a, b);
  },

  max: (args) => {
    const a = toNumber(args[0]);
    const b = toNumber(args[1]);
    return Math.max(a, b);
  },

  dateAdd: (args) => {
    const date = toDate(args[0]);
    if (!date) return null;
    const amount = toNumber(args[1]);
    const unit = String(args[2] ?? "days");
    const result = new Date(date.getTime());
    switch (unit) {
      case "days":
        result.setDate(result.getDate() + amount);
        break;
      case "months":
        result.setMonth(result.getMonth() + amount);
        break;
      case "years":
        result.setFullYear(result.getFullYear() + amount);
        break;
      default:
        return null;
    }
    return result;
  },

  dateDiff: (args) => {
    const date1 = toDate(args[0]);
    const date2 = toDate(args[1]);
    if (!date1 || !date2) return NaN;
    const unit = String(args[2] ?? "days");
    const diffMs = date1.getTime() - date2.getTime();
    switch (unit) {
      case "days":
        return Math.floor(diffMs / 86_400_000);
      case "months": {
        const months =
          (date1.getFullYear() - date2.getFullYear()) * 12 +
          (date1.getMonth() - date2.getMonth());
        return months;
      }
      case "years":
        return date1.getFullYear() - date2.getFullYear();
      default:
        return NaN;
    }
  },

  format: (args) => {
    const num = toNumber(args[0]);
    const decimals = args.length > 1 ? toNumber(args[1]) : 0;
    if (isNaN(num) || isNaN(decimals)) return "NaN";
    return num.toFixed(decimals);
  },
};

// ---------------------------------------------------------------------------
// Type coercion helpers
// ---------------------------------------------------------------------------

function toNumber(val: FormulaValue): number {
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "string") {
    const n = Number(val);
    return isNaN(n) ? NaN : n;
  }
  if (val instanceof Date) return val.getTime();
  return NaN;
}

function toBoolean(val: FormulaValue): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0 && !isNaN(val);
  if (typeof val === "string") return val.length > 0;
  if (val instanceof Date) return true;
  return false;
}

function toDate(val: FormulaValue): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") return new Date(val);
  return null;
}

function isStringish(val: FormulaValue): boolean {
  return typeof val === "string";
}

/**
 * Evaluate an AST node against a formula context.
 * @param evaluatingProps - set of property names currently being evaluated (cycle detection)
 */
export function evaluate(
  node: ASTNode,
  ctx: FormulaContext,
  evaluatingProps: Set<string> = new Set(),
): FormulaValue {
  switch (node.type) {
    case "number":
      return node.value;
    case "string":
      return node.value;
    case "boolean":
      return node.value;

    case "unary": {
      const operand = evaluate(node.operand, ctx, evaluatingProps);
      if (node.op === "!") return !toBoolean(operand);
      if (node.op === "-") return -toNumber(operand);
      return null;
    }

    case "binary": {
      const left = evaluate(node.left, ctx, evaluatingProps);
      const right = evaluate(node.right, ctx, evaluatingProps);
      return evaluateBinary(node.op, left, right);
    }

    case "if": {
      const condition = evaluate(node.condition, ctx, evaluatingProps);
      return toBoolean(condition)
        ? evaluate(node.then, ctx, evaluatingProps)
        : evaluate(node.else, ctx, evaluatingProps);
    }

    case "prop": {
      const propName = node.name;

      // Cycle detection
      if (evaluatingProps.has(propName)) {
        throw new FormulaError(`Circular reference: ${propName}`);
      }

      // Check if the referenced property is itself a formula
      const propDef = ctx.getPropertyByName(propName);
      if (propDef && propDef.type === "formula") {
        const expression = propDef.config.expression;
        if (typeof expression !== "string" || !expression.trim()) {
          return null;
        }
        const ast = parseFormula(expression);
        const nextEvaluating = new Set(evaluatingProps);
        nextEvaluating.add(propName);
        return evaluate(ast, ctx, nextEvaluating);
      }

      return ctx.getPropertyValue(propName);
    }

    case "call": {
      const fn = BUILTIN_FUNCTIONS[node.name];
      if (!fn) {
        throw new FormulaError(`Unknown function: ${node.name}`);
      }
      const args = node.args.map((arg) => evaluate(arg, ctx, evaluatingProps));
      return fn(args);
    }
  }
}

function evaluateBinary(
  op: BinaryOp,
  left: FormulaValue,
  right: FormulaValue,
): FormulaValue {
  switch (op) {
    case "+":
      // String concatenation if either operand is a string
      if (isStringish(left) || isStringish(right)) {
        return String(left ?? "") + String(right ?? "");
      }
      return toNumber(left) + toNumber(right);
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/": {
      const divisor = toNumber(right);
      if (divisor === 0) return NaN;
      return toNumber(left) / divisor;
    }
    case "%": {
      const mod = toNumber(right);
      if (mod === 0) return NaN;
      return toNumber(left) % mod;
    }
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return toNumber(left) > toNumber(right);
    case "<":
      return toNumber(left) < toNumber(right);
    case ">=":
      return toNumber(left) >= toNumber(right);
    case "<=":
      return toNumber(left) <= toNumber(right);
    case "&&":
      return toBoolean(left) && toBoolean(right);
    case "||":
      return toBoolean(left) || toBoolean(right);
  }
}

// ---------------------------------------------------------------------------
// High-level evaluation entry point
// ---------------------------------------------------------------------------

export interface FormulaResult {
  value: FormulaValue;
  error: string | null;
}

/**
 * Parse and evaluate a formula expression. Returns the computed value or an error message.
 * Never throws — errors are returned in the result object.
 */
export function evaluateFormula(
  expression: string,
  ctx: FormulaContext,
): FormulaResult {
  try {
    const ast = parseFormula(expression);
    const value = evaluate(ast, ctx);
    return { value, error: null };
  } catch (err) {
    const message =
      err instanceof FormulaError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    return { value: null, error: message };
  }
}

/**
 * Format a formula result for display in a cell.
 */
export function formatFormulaValue(value: FormulaValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (isNaN(value)) return "Error";
    return value.toLocaleString("en-US");
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "Error";
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return String(value);
}
