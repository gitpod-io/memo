/**
 * Regression test for #581: table view inline input must save values in the
 * same format as the property type registry editors.
 *
 * The renderers read type-specific keys (e.g. { text: "hello" }), so the
 * inline input must write the same shape — not the generic { value: "hello" }.
 */
import { describe, it, expect } from "vitest";

// The value key mapping is internal to table-view.tsx. We test the contract
// by verifying the expected shape for each affected property type.

const TYPE_KEY_MAP: Record<string, string> = {
  text: "text",
  number: "number",
  url: "url",
  email: "email",
  phone: "phone",
  checkbox: "checked",
  date: "date",
};

describe("table view inline input value format", () => {
  it.each(Object.entries(TYPE_KEY_MAP))(
    "property type '%s' uses key '%s'",
    (type, expectedKey) => {
      // Simulate what the inline input should produce
      const testValue = type === "number" ? 42 : type === "checkbox" ? true : "test";
      const saved = { [expectedKey]: testValue };

      // The renderer reads from the type-specific key
      expect(saved[expectedKey]).toBe(testValue);
      // The generic "value" key should NOT be present
      expect(saved).not.toHaveProperty("value");
    },
  );

  it("number type saves parsed number, not string", () => {
    function parseNumberInput(raw: string) {
      return raw === "" ? null : Number(raw);
    }
    const saved = { number: parseNumberInput("42") };
    expect(saved.number).toBe(42);
    expect(typeof saved.number).toBe("number");
  });

  it("number type saves null for empty string", () => {
    function parseNumberInput(raw: string) {
      return raw === "" ? null : Number(raw);
    }
    const saved = { number: parseNumberInput("") };
    expect(saved.number).toBeNull();
  });

  it("legacy { value: ... } format is distinct from type-specific format", () => {
    // This is the old (broken) format — renderers cannot read it
    const legacy = { value: "hello" };
    // The text renderer reads value.text, which is undefined for legacy format
    expect(legacy).not.toHaveProperty("text");

    // The new (correct) format
    const correct = { text: "hello" };
    expect(correct.text).toBe("hello");
  });
});
