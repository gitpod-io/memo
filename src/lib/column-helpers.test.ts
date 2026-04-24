import { describe, it, expect, vi } from "vitest";
import type { PropertyType } from "@/lib/types";
import { PROPERTY_TYPE_LABEL } from "@/lib/property-icons";
import {
  generateColumnName,
  getDefaultColumnConfig,
  createConcurrencyGuard,
  DEFAULT_STATUS_OPTIONS,
} from "./column-helpers";

// ---------------------------------------------------------------------------
// All property types — used for exhaustive parameterized tests
// ---------------------------------------------------------------------------

const ALL_PROPERTY_TYPES: PropertyType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "checkbox",
  "date",
  "url",
  "email",
  "phone",
  "person",
  "files",
  "relation",
  "formula",
  "created_time",
  "updated_time",
  "created_by",
];

// ---------------------------------------------------------------------------
// generateColumnName
// ---------------------------------------------------------------------------

describe("generateColumnName", () => {
  it.each(ALL_PROPERTY_TYPES)(
    "returns the correct default label for type '%s'",
    (type) => {
      const name = generateColumnName(type, new Set());
      expect(name).toBe(PROPERTY_TYPE_LABEL[type]);
    },
  );

  it("appends a numeric suffix when the base name already exists", () => {
    const existing = new Set(["Text"]);
    const name = generateColumnName("text", existing);
    expect(name).toBe("Text 2");
  });

  it("increments suffix until a unique name is found", () => {
    const existing = new Set(["Status", "Status 2", "Status 3"]);
    const name = generateColumnName("status", existing);
    expect(name).toBe("Status 4");
  });

  it("does not append suffix when the base name is unique", () => {
    const existing = new Set(["Other Column"]);
    const name = generateColumnName("date", existing);
    expect(name).toBe("Date");
  });

  it("handles an empty set of existing names", () => {
    const name = generateColumnName("number", new Set());
    expect(name).toBe("Number");
  });

  it("handles many collisions without infinite loop", () => {
    const existing = new Set<string>();
    // Pre-fill "Select", "Select 2" through "Select 100"
    existing.add("Select");
    for (let i = 2; i <= 100; i++) {
      existing.add(`Select ${i}`);
    }
    const name = generateColumnName("select", existing);
    expect(name).toBe("Select 101");
  });
});

// ---------------------------------------------------------------------------
// getDefaultColumnConfig
// ---------------------------------------------------------------------------

describe("getDefaultColumnConfig", () => {
  it("returns default status options for status type", () => {
    const config = getDefaultColumnConfig("status");
    expect(config).toEqual({ options: DEFAULT_STATUS_OPTIONS });
    expect(config.options).toHaveLength(3);
  });

  it("status options have the expected shape", () => {
    const config = getDefaultColumnConfig("status");
    const options = config.options as Array<{
      id: string;
      name: string;
      color: string;
    }>;
    for (const opt of options) {
      expect(typeof opt.id).toBe("string");
      expect(typeof opt.name).toBe("string");
      expect(typeof opt.color).toBe("string");
      expect(opt.id.length).toBeGreaterThan(0);
      expect(opt.name.length).toBeGreaterThan(0);
    }
  });

  it("status options include Not Started, In Progress, and Done", () => {
    const config = getDefaultColumnConfig("status");
    const names = (
      config.options as Array<{ name: string }>
    ).map((o) => o.name);
    expect(names).toContain("Not Started");
    expect(names).toContain("In Progress");
    expect(names).toContain("Done");
  });

  const NON_STATUS_TYPES = ALL_PROPERTY_TYPES.filter((t) => t !== "status");

  it.each(NON_STATUS_TYPES)(
    "returns empty config for non-status type '%s'",
    (type) => {
      const config = getDefaultColumnConfig(type);
      expect(config).toEqual({});
    },
  );
});

// ---------------------------------------------------------------------------
// Integration: generateColumnName + getDefaultColumnConfig together
// ---------------------------------------------------------------------------

describe("column add flow integration", () => {
  it.each(ALL_PROPERTY_TYPES)(
    "produces valid name and config for type '%s' with no existing columns",
    (type) => {
      const name = generateColumnName(type, new Set());
      const config = getDefaultColumnConfig(type);

      // Name is always a non-empty string
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);

      // Config is always a plain object
      expect(typeof config).toBe("object");
      expect(config).not.toBeNull();
      expect(Array.isArray(config)).toBe(false);
    },
  );

  it("simulates adding multiple columns of the same type", () => {
    const existing = new Set<string>();
    const names: string[] = [];

    // Add 5 "Text" columns
    for (let i = 0; i < 5; i++) {
      const name = generateColumnName("text", existing);
      expect(names).not.toContain(name); // no duplicates
      names.push(name);
      existing.add(name);
    }

    expect(names).toEqual(["Text", "Text 2", "Text 3", "Text 4", "Text 5"]);
  });
});

// ---------------------------------------------------------------------------
// createConcurrencyGuard (double-click prevention)
// ---------------------------------------------------------------------------

describe("createConcurrencyGuard", () => {
  it("executes the callback on first call", async () => {
    const fn = vi.fn(async () => {});
    const { guarded } = createConcurrencyGuard(fn);

    await guarded();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("drops concurrent calls while the first is still running", async () => {
    let resolve: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });
    const fn = vi.fn(async () => blocker);
    const { guarded } = createConcurrencyGuard(fn);

    // Start first call (will block on the promise)
    const first = guarded();

    // Fire concurrent calls — these should be dropped
    await guarded();
    await guarded();
    await guarded();

    // Unblock the first call
    resolve!();
    await first;

    // Only the first call should have executed
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows a new call after the first completes", async () => {
    const fn = vi.fn(async () => {});
    const { guarded } = createConcurrencyGuard(fn);

    await guarded();
    await guarded();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("resets the guard even if the callback throws", async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error("fail");
    });
    const { guarded } = createConcurrencyGuard(fn);

    // First call throws
    await guarded().catch(() => {});

    // Second call should still execute (guard was reset in finally)
    await guarded();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("reports running state correctly", async () => {
    let resolve: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });
    const fn = vi.fn(async () => blocker);
    const { guarded, isRunning } = createConcurrencyGuard(fn);

    expect(isRunning()).toBe(false);

    const promise = guarded();
    expect(isRunning()).toBe(true);

    resolve!();
    await promise;
    expect(isRunning()).toBe(false);
  });

  it("passes arguments through to the wrapped function", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fn = vi.fn(async (_a: string, _b: number) => {});
    const { guarded } = createConcurrencyGuard(fn);

    await guarded("hello", 42);

    expect(fn).toHaveBeenCalledWith("hello", 42);
  });
});
