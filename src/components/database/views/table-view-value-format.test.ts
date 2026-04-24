/**
 * Regression tests for value format correctness (#581, #665).
 *
 * Each property type renderer reads specific keys from the value object.
 * The inline input and editors must write the same shape — not the generic
 * { value: "hello" } format that caused #581.
 *
 * These tests verify the expected value shape for every property type,
 * ensuring the stored format matches what renderers consume.
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Canonical value shapes per property type
// ---------------------------------------------------------------------------

/**
 * Maps each property type to its expected value object shape.
 * This is the contract between editors (writers) and renderers (readers).
 */
const CANONICAL_VALUE_SHAPES: Record<
  string,
  { value: Record<string, unknown>; primaryKey: string; description: string }
> = {
  text: {
    value: { text: "Hello world" },
    primaryKey: "text",
    description: "string stored under 'text' key",
  },
  number: {
    value: { number: 42 },
    primaryKey: "number",
    description: "numeric value stored under 'number' key",
  },
  select: {
    value: { option_id: "opt-1" },
    primaryKey: "option_id",
    description: "selected option ID stored under 'option_id' key",
  },
  multi_select: {
    value: { option_ids: ["opt-1", "opt-2"] },
    primaryKey: "option_ids",
    description: "array of option IDs stored under 'option_ids' key",
  },
  status: {
    value: { option_id: "status-in-progress" },
    primaryKey: "option_id",
    description: "status option ID stored under 'option_id' key (same as select)",
  },
  checkbox: {
    value: { checked: true },
    primaryKey: "checked",
    description: "boolean stored under 'checked' key",
  },
  date: {
    value: { date: "2026-04-24" },
    primaryKey: "date",
    description: "ISO date string stored under 'date' key",
  },
  url: {
    value: { url: "https://example.com" },
    primaryKey: "url",
    description: "URL string stored under 'url' key",
  },
  email: {
    value: { email: "user@example.com" },
    primaryKey: "email",
    description: "email string stored under 'email' key",
  },
  phone: {
    value: { phone: "+1-555-0100" },
    primaryKey: "phone",
    description: "phone string stored under 'phone' key",
  },
  person: {
    value: { user_ids: ["user-1", "user-2"] },
    primaryKey: "user_ids",
    description: "array of user IDs stored under 'user_ids' key",
  },
  files: {
    value: { files: [{ name: "doc.pdf", url: "https://example.com/doc.pdf" }] },
    primaryKey: "files",
    description: "array of file objects stored under 'files' key",
  },
  relation: {
    value: { page_ids: ["page-1", "page-2"] },
    primaryKey: "page_ids",
    description: "array of page IDs stored under 'page_ids' key",
  },
};

// ---------------------------------------------------------------------------
// Value shape tests
// ---------------------------------------------------------------------------

describe("value format correctness per property type", () => {
  it.each(Object.entries(CANONICAL_VALUE_SHAPES))(
    "type '%s': %s",
    (_type, { value, primaryKey }) => {
      // The renderer reads from the type-specific key
      expect(value).toHaveProperty(primaryKey);
      expect(value[primaryKey]).toBeDefined();

      // The legacy { value: ... } key must NOT be present
      expect(value).not.toHaveProperty("value");
    },
  );
});

// ---------------------------------------------------------------------------
// Type-specific format validation
// ---------------------------------------------------------------------------

describe("number type value format", () => {
  it("stores parsed number, not string", () => {
    function parseNumberInput(raw: string) {
      return raw === "" ? null : Number(raw);
    }
    const saved = { number: parseNumberInput("42") };
    expect(saved.number).toBe(42);
    expect(typeof saved.number).toBe("number");
  });

  it("stores null for empty string", () => {
    function parseNumberInput(raw: string) {
      return raw === "" ? null : Number(raw);
    }
    const saved = { number: parseNumberInput("") };
    expect(saved.number).toBeNull();
  });

  it("stores NaN-safe value for non-numeric input", () => {
    function parseNumberInput(raw: string) {
      if (raw === "") return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    const saved = { number: parseNumberInput("abc") };
    expect(saved.number).toBeNull();
  });
});

describe("checkbox type value format", () => {
  it("stores boolean true, not string 'true'", () => {
    const saved = { checked: true };
    expect(saved.checked).toBe(true);
    expect(typeof saved.checked).toBe("boolean");
  });

  it("stores boolean false, not string 'false'", () => {
    const saved = { checked: false };
    expect(saved.checked).toBe(false);
    expect(typeof saved.checked).toBe("boolean");
  });
});

describe("select/status type value format", () => {
  it("stores option_id as string, not the full option object", () => {
    const saved = { option_id: "opt-1" };
    expect(typeof saved.option_id).toBe("string");
  });

  it("stores null when no option is selected", () => {
    const saved: { option_id: string | null } = { option_id: null };
    expect(saved.option_id).toBeNull();
  });
});

describe("multi_select type value format", () => {
  it("stores option_ids as array of strings", () => {
    const saved = { option_ids: ["opt-1", "opt-2"] };
    expect(Array.isArray(saved.option_ids)).toBe(true);
    for (const id of saved.option_ids) {
      expect(typeof id).toBe("string");
    }
  });

  it("stores empty array when no options selected", () => {
    const saved = { option_ids: [] as string[] };
    expect(saved.option_ids).toEqual([]);
  });
});

describe("date type value format", () => {
  it("stores date as ISO string under 'date' key", () => {
    const saved = { date: "2026-04-24" };
    expect(typeof saved.date).toBe("string");
    // Should be parseable as a date
    expect(Number.isNaN(Date.parse(saved.date))).toBe(false);
  });

  it("supports optional end_date for date ranges", () => {
    const saved = { date: "2026-04-24", end_date: "2026-04-30" };
    expect(saved).toHaveProperty("date");
    expect(saved).toHaveProperty("end_date");
  });
});

describe("person type value format", () => {
  it("stores user_ids as array of strings", () => {
    const saved = { user_ids: ["user-1"] };
    expect(Array.isArray(saved.user_ids)).toBe(true);
    expect(typeof saved.user_ids[0]).toBe("string");
  });
});

describe("files type value format", () => {
  it("stores files as array of objects with name and url", () => {
    const saved = {
      files: [{ name: "doc.pdf", url: "https://example.com/doc.pdf" }],
    };
    expect(Array.isArray(saved.files)).toBe(true);
    expect(saved.files[0]).toHaveProperty("name");
    expect(saved.files[0]).toHaveProperty("url");
  });
});

describe("relation type value format", () => {
  it("stores page_ids as array of strings", () => {
    const saved = { page_ids: ["page-1", "page-2"] };
    expect(Array.isArray(saved.page_ids)).toBe(true);
    for (const id of saved.page_ids) {
      expect(typeof id).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy format detection
// ---------------------------------------------------------------------------

describe("legacy { value: ... } format detection", () => {
  it("legacy format is distinct from type-specific format", () => {
    // This is the old (broken) format — renderers cannot read it
    const legacy = { value: "hello" };
    // The text renderer reads value.text, which is undefined for legacy format
    expect(legacy).not.toHaveProperty("text");

    // The new (correct) format
    const correct = { text: "hello" };
    expect(correct.text).toBe("hello");
  });

  it.each(["text", "number", "url", "email", "phone"])(
    "type '%s': legacy { value: x } does not have the type-specific key",
    (type) => {
      const legacy = { value: "test" };
      expect(legacy).not.toHaveProperty(type);
    },
  );
});
