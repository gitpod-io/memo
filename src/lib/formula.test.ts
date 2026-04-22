import { describe, it, expect } from "vitest";
import {
  parseFormula,
  evaluate,
  evaluateFormula,
  formatFormulaValue,
  FormulaError,
  type FormulaContext,
  type FormulaValue,
} from "./formula";

// ---------------------------------------------------------------------------
// Helper: build a simple context from a key-value map
// ---------------------------------------------------------------------------

function makeCtx(
  values: Record<string, FormulaValue>,
  formulas?: Record<string, string>,
): FormulaContext {
  return {
    getPropertyValue: (name) => values[name] ?? null,
    getPropertyByName: (name) => {
      if (formulas && name in formulas) {
        return { type: "formula", config: { expression: formulas[name] } };
      }
      if (name in values) {
        return { type: "text", config: {} };
      }
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe("parseFormula", () => {
  it("parses number literals", () => {
    const ast = parseFormula("42");
    expect(ast).toEqual({ type: "number", value: 42 });
  });

  it("parses decimal numbers", () => {
    const ast = parseFormula("3.14");
    expect(ast).toEqual({ type: "number", value: 3.14 });
  });

  it("parses string literals", () => {
    const ast = parseFormula('"hello"');
    expect(ast).toEqual({ type: "string", value: "hello" });
  });

  it("parses boolean literals", () => {
    expect(parseFormula("true")).toEqual({ type: "boolean", value: true });
    expect(parseFormula("false")).toEqual({ type: "boolean", value: false });
  });

  it("parses prop() references", () => {
    const ast = parseFormula('prop("Price")');
    expect(ast).toEqual({ type: "prop", name: "Price" });
  });

  it("parses arithmetic expressions", () => {
    const ast = parseFormula("1 + 2 * 3");
    // Should respect precedence: 1 + (2 * 3)
    expect(ast.type).toBe("binary");
  });

  it("parses comparison operators", () => {
    const ast = parseFormula("1 > 2");
    expect(ast).toEqual({
      type: "binary",
      op: ">",
      left: { type: "number", value: 1 },
      right: { type: "number", value: 2 },
    });
  });

  it("parses logical operators", () => {
    const ast = parseFormula("true && false");
    expect(ast.type).toBe("binary");
  });

  it("parses if() expressions", () => {
    const ast = parseFormula("if(true, 1, 2)");
    expect(ast.type).toBe("if");
  });

  it("parses function calls", () => {
    const ast = parseFormula("abs(-5)");
    expect(ast.type).toBe("call");
  });

  it("parses nested expressions", () => {
    const ast = parseFormula('prop("A") + prop("B") * 2');
    expect(ast.type).toBe("binary");
  });

  it("parses unary negation", () => {
    const ast = parseFormula("-5");
    expect(ast).toEqual({
      type: "unary",
      op: "-",
      operand: { type: "number", value: 5 },
    });
  });

  it("parses unary not", () => {
    const ast = parseFormula("!true");
    expect(ast).toEqual({
      type: "unary",
      op: "!",
      operand: { type: "boolean", value: true },
    });
  });

  it("parses parenthesized expressions", () => {
    const ast = parseFormula("(1 + 2) * 3");
    expect(ast.type).toBe("binary");
  });

  it("throws on empty expression", () => {
    expect(() => parseFormula("")).toThrow(FormulaError);
    expect(() => parseFormula("   ")).toThrow(FormulaError);
  });

  it("throws on unterminated string", () => {
    expect(() => parseFormula('"hello')).toThrow("Unterminated string");
  });

  it("throws on unexpected character", () => {
    expect(() => parseFormula("@")).toThrow("Unexpected character");
  });

  it("throws on unexpected token after expression", () => {
    expect(() => parseFormula("1 2")).toThrow("Unexpected token");
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — arithmetic
// ---------------------------------------------------------------------------

describe("evaluate — arithmetic", () => {
  const ctx = makeCtx({});

  it("evaluates addition", () => {
    const result = evaluate(parseFormula("2 + 3"), ctx);
    expect(result).toBe(5);
  });

  it("evaluates subtraction", () => {
    const result = evaluate(parseFormula("10 - 4"), ctx);
    expect(result).toBe(6);
  });

  it("evaluates multiplication", () => {
    const result = evaluate(parseFormula("3 * 7"), ctx);
    expect(result).toBe(21);
  });

  it("evaluates division", () => {
    const result = evaluate(parseFormula("15 / 3"), ctx);
    expect(result).toBe(5);
  });

  it("evaluates modulo", () => {
    const result = evaluate(parseFormula("10 % 3"), ctx);
    expect(result).toBe(1);
  });

  it("returns NaN for division by zero", () => {
    const result = evaluate(parseFormula("5 / 0"), ctx);
    expect(result).toBeNaN();
  });

  it("returns NaN for modulo by zero", () => {
    const result = evaluate(parseFormula("5 % 0"), ctx);
    expect(result).toBeNaN();
  });

  it("respects operator precedence", () => {
    const result = evaluate(parseFormula("2 + 3 * 4"), ctx);
    expect(result).toBe(14);
  });

  it("respects parentheses", () => {
    const result = evaluate(parseFormula("(2 + 3) * 4"), ctx);
    expect(result).toBe(20);
  });

  it("evaluates unary negation", () => {
    const result = evaluate(parseFormula("-5"), ctx);
    expect(result).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — string operations
// ---------------------------------------------------------------------------

describe("evaluate — strings", () => {
  const ctx = makeCtx({});

  it("concatenates strings with +", () => {
    const result = evaluate(parseFormula('"hello" + " " + "world"'), ctx);
    expect(result).toBe("hello world");
  });

  it("concatenates string + number", () => {
    const result = evaluate(parseFormula('"count: " + 42'), ctx);
    expect(result).toBe("count: 42");
  });

  it("concatenates number + string", () => {
    const result = evaluate(parseFormula('42 + " items"'), ctx);
    expect(result).toBe("42 items");
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — comparisons
// ---------------------------------------------------------------------------

describe("evaluate — comparisons", () => {
  const ctx = makeCtx({});

  it("evaluates ==", () => {
    expect(evaluate(parseFormula("1 == 1"), ctx)).toBe(true);
    expect(evaluate(parseFormula("1 == 2"), ctx)).toBe(false);
  });

  it("evaluates !=", () => {
    expect(evaluate(parseFormula("1 != 2"), ctx)).toBe(true);
    expect(evaluate(parseFormula("1 != 1"), ctx)).toBe(false);
  });

  it("evaluates >", () => {
    expect(evaluate(parseFormula("3 > 2"), ctx)).toBe(true);
    expect(evaluate(parseFormula("2 > 3"), ctx)).toBe(false);
  });

  it("evaluates <", () => {
    expect(evaluate(parseFormula("2 < 3"), ctx)).toBe(true);
  });

  it("evaluates >=", () => {
    expect(evaluate(parseFormula("3 >= 3"), ctx)).toBe(true);
    expect(evaluate(parseFormula("2 >= 3"), ctx)).toBe(false);
  });

  it("evaluates <=", () => {
    expect(evaluate(parseFormula("3 <= 3"), ctx)).toBe(true);
    expect(evaluate(parseFormula("4 <= 3"), ctx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — logical operators
// ---------------------------------------------------------------------------

describe("evaluate — logical", () => {
  const ctx = makeCtx({});

  it("evaluates &&", () => {
    expect(evaluate(parseFormula("true && true"), ctx)).toBe(true);
    expect(evaluate(parseFormula("true && false"), ctx)).toBe(false);
  });

  it("evaluates ||", () => {
    expect(evaluate(parseFormula("false || true"), ctx)).toBe(true);
    expect(evaluate(parseFormula("false || false"), ctx)).toBe(false);
  });

  it("evaluates !", () => {
    expect(evaluate(parseFormula("!true"), ctx)).toBe(false);
    expect(evaluate(parseFormula("!false"), ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — if()
// ---------------------------------------------------------------------------

describe("evaluate — if()", () => {
  const ctx = makeCtx({});

  it("returns then branch when condition is true", () => {
    const result = evaluate(parseFormula('if(true, "yes", "no")'), ctx);
    expect(result).toBe("yes");
  });

  it("returns else branch when condition is false", () => {
    const result = evaluate(parseFormula('if(false, "yes", "no")'), ctx);
    expect(result).toBe("no");
  });

  it("evaluates condition expression", () => {
    const result = evaluate(parseFormula("if(1 > 0, 100, 200)"), ctx);
    expect(result).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — prop() references
// ---------------------------------------------------------------------------

describe("evaluate — prop()", () => {
  it("resolves property values", () => {
    const ctx = makeCtx({ Price: 10, Quantity: 5 });
    const result = evaluate(
      parseFormula('prop("Price") * prop("Quantity")'),
      ctx,
    );
    expect(result).toBe(50);
  });

  it("returns null for missing properties", () => {
    const ctx = makeCtx({});
    const result = evaluate(parseFormula('prop("Missing")'), ctx);
    expect(result).toBeNull();
  });

  it("resolves string properties", () => {
    const ctx = makeCtx({ Name: "Alice" });
    const result = evaluate(parseFormula('prop("Name")'), ctx);
    expect(result).toBe("Alice");
  });

  it("resolves boolean properties", () => {
    const ctx = makeCtx({ Done: true });
    const result = evaluate(parseFormula('prop("Done")'), ctx);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — built-in functions
// ---------------------------------------------------------------------------

describe("evaluate — functions", () => {
  const ctx = makeCtx({});

  it("now() returns a Date", () => {
    const result = evaluate(parseFormula("now()"), ctx);
    expect(result).toBeInstanceOf(Date);
  });

  it("length() returns string length", () => {
    const result = evaluate(parseFormula('length("hello")'), ctx);
    expect(result).toBe(5);
  });

  it("length() returns 0 for non-strings", () => {
    const result = evaluate(parseFormula("length(42)"), ctx);
    expect(result).toBe(0);
  });

  it("round() rounds to specified decimals", () => {
    expect(evaluate(parseFormula("round(3.14159, 2)"), ctx)).toBe(3.14);
    expect(evaluate(parseFormula("round(3.5)"), ctx)).toBe(4);
  });

  it("floor() floors a number", () => {
    expect(evaluate(parseFormula("floor(3.7)"), ctx)).toBe(3);
  });

  it("ceil() ceils a number", () => {
    expect(evaluate(parseFormula("ceil(3.2)"), ctx)).toBe(4);
  });

  it("abs() returns absolute value", () => {
    expect(evaluate(parseFormula("abs(-5)"), ctx)).toBe(5);
    expect(evaluate(parseFormula("abs(5)"), ctx)).toBe(5);
  });

  it("min() returns the smaller value", () => {
    expect(evaluate(parseFormula("min(3, 7)"), ctx)).toBe(3);
  });

  it("max() returns the larger value", () => {
    expect(evaluate(parseFormula("max(3, 7)"), ctx)).toBe(7);
  });

  it("format() formats a number", () => {
    expect(evaluate(parseFormula("format(3.14159, 2)"), ctx)).toBe("3.14");
    expect(evaluate(parseFormula("format(1000)"), ctx)).toBe("1000");
  });

  it("throws on unknown function", () => {
    expect(() => evaluate(parseFormula("unknown()"), ctx)).toThrow(
      "Unknown function: unknown",
    );
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — date functions
// ---------------------------------------------------------------------------

describe("evaluate — date functions", () => {
  const ctx = makeCtx({});

  it("dateAdd() adds days", () => {
    const result = evaluate(
      parseFormula('dateAdd("2026-01-01", 5, "days")'),
      ctx,
    );
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getDate()).toBe(6);
  });

  it("dateAdd() adds months", () => {
    const result = evaluate(
      parseFormula('dateAdd("2026-01-15", 2, "months")'),
      ctx,
    );
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getMonth()).toBe(2); // March (0-indexed)
  });

  it("dateAdd() adds years", () => {
    const result = evaluate(
      parseFormula('dateAdd("2026-01-01", 1, "years")'),
      ctx,
    );
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getFullYear()).toBe(2027);
  });

  it("dateDiff() computes day difference", () => {
    const result = evaluate(
      parseFormula('dateDiff("2026-01-10", "2026-01-01", "days")'),
      ctx,
    );
    expect(result).toBe(9);
  });

  it("dateDiff() computes month difference", () => {
    const result = evaluate(
      parseFormula('dateDiff("2026-06-01", "2026-01-01", "months")'),
      ctx,
    );
    expect(result).toBe(5);
  });

  it("dateDiff() computes year difference", () => {
    const result = evaluate(
      parseFormula('dateDiff("2028-01-01", "2026-01-01", "years")'),
      ctx,
    );
    expect(result).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Evaluator tests — circular reference detection
// ---------------------------------------------------------------------------

describe("evaluate — circular references", () => {
  it("detects direct circular reference", () => {
    const ctx = makeCtx({}, { A: 'prop("A")' });
    const result = evaluateFormula('prop("A")', ctx);
    expect(result.error).toContain("Circular reference");
  });

  it("detects indirect circular reference", () => {
    const ctx = makeCtx({}, { A: 'prop("B")', B: 'prop("A")' });
    const result = evaluateFormula('prop("A")', ctx);
    expect(result.error).toContain("Circular reference");
  });

  it("evaluates non-circular formula references", () => {
    const ctx = makeCtx(
      { Base: 100 },
      { Doubled: 'prop("Base") * 2' },
    );
    const result = evaluateFormula('prop("Doubled")', ctx);
    expect(result.value).toBe(200);
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateFormula — high-level entry point
// ---------------------------------------------------------------------------

describe("evaluateFormula", () => {
  it("returns value on success", () => {
    const ctx = makeCtx({ Price: 10, Qty: 3 });
    const result = evaluateFormula('prop("Price") * prop("Qty")', ctx);
    expect(result.value).toBe(30);
    expect(result.error).toBeNull();
  });

  it("returns error on invalid expression", () => {
    const ctx = makeCtx({});
    const result = evaluateFormula("@invalid", ctx);
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("returns error on unknown function", () => {
    const ctx = makeCtx({});
    const result = evaluateFormula("badFunc()", ctx);
    expect(result.error).toContain("Unknown function");
  });
});

// ---------------------------------------------------------------------------
// formatFormulaValue
// ---------------------------------------------------------------------------

describe("formatFormulaValue", () => {
  it("formats null as empty string", () => {
    expect(formatFormulaValue(null)).toBe("");
  });

  it("formats booleans as Yes/No", () => {
    expect(formatFormulaValue(true)).toBe("Yes");
    expect(formatFormulaValue(false)).toBe("No");
  });

  it("formats NaN as Error", () => {
    expect(formatFormulaValue(NaN)).toBe("Error");
  });

  it("formats numbers with locale", () => {
    const result = formatFormulaValue(1234.5);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("formats dates", () => {
    const result = formatFormulaValue(new Date("2026-06-15"));
    expect(result).toContain("2026");
  });

  it("formats strings as-is", () => {
    expect(formatFormulaValue("hello")).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// Complex expression tests
// ---------------------------------------------------------------------------

describe("complex expressions", () => {
  it("evaluates a pricing formula", () => {
    const ctx = makeCtx({ Price: 25, Quantity: 4, Discount: 0.1 });
    const result = evaluateFormula(
      'prop("Price") * prop("Quantity") * (1 - prop("Discount"))',
      ctx,
    );
    expect(result.value).toBe(90);
  });

  it("evaluates a conditional status formula", () => {
    const ctx = makeCtx({ Score: 85 });
    const result = evaluateFormula(
      'if(prop("Score") >= 90, "A", if(prop("Score") >= 80, "B", "C"))',
      ctx,
    );
    expect(result.value).toBe("B");
  });

  it("evaluates string concatenation with prop", () => {
    const ctx = makeCtx({ First: "John", Last: "Doe" });
    const result = evaluateFormula(
      'prop("First") + " " + prop("Last")',
      ctx,
    );
    expect(result.value).toBe("John Doe");
  });

  it("evaluates a formula with multiple functions", () => {
    const ctx = makeCtx({ Value: -3.7 });
    const result = evaluateFormula('abs(floor(prop("Value")))', ctx);
    expect(result.value).toBe(4);
  });
});
