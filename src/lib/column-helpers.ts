// Pure helper functions for the database column-add flow.
// Extracted from database-view-client.tsx so they can be unit-tested
// without rendering React components.

import type { PropertyType, SelectOption } from "@/lib/types";
import { PROPERTY_TYPE_LABEL } from "@/lib/property-icons";

// ---------------------------------------------------------------------------
// Concurrency guard for column creation
// ---------------------------------------------------------------------------

/**
 * Wraps an async callback so that concurrent invocations are dropped.
 * Returns a guarded version of the callback and an `isRunning` accessor.
 * Used to prevent duplicate columns from rapid double-clicks.
 */
export function createConcurrencyGuard<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
): { guarded: (...args: T) => Promise<void>; isRunning: () => boolean } {
  let running = false;
  return {
    guarded: async (...args: T) => {
      if (running) return;
      running = true;
      try {
        await fn(...args);
      } finally {
        running = false;
      }
    },
    isRunning: () => running,
  };
}

// ---------------------------------------------------------------------------
// Default status options — canonical source is property-types/status.tsx,
// re-exported here to avoid importing a "use client" component module
// from non-React code.
// ---------------------------------------------------------------------------

export const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { id: "status-not-started", name: "Not Started", color: "gray" },
  { id: "status-in-progress", name: "In Progress", color: "blue" },
  { id: "status-done", name: "Done", color: "green" },
];

// ---------------------------------------------------------------------------
// Column name generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique column name for a new property.
 * Uses the human-readable label for the type (e.g. "Date", "Status")
 * and appends a numeric suffix if the name already exists.
 */
export function generateColumnName(
  type: PropertyType,
  existingNames: ReadonlySet<string>,
): string {
  const baseLabel = PROPERTY_TYPE_LABEL[type];
  let name = baseLabel;
  let suffix = 2;
  while (existingNames.has(name)) {
    name = `${baseLabel} ${suffix}`;
    suffix++;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Default config seeding
// ---------------------------------------------------------------------------

/**
 * Return the default config object for a new property of the given type.
 * Status properties are seeded with default options; all others get `{}`.
 */
export function getDefaultColumnConfig(
  type: PropertyType,
): Record<string, unknown> {
  if (type === "status") {
    return { options: DEFAULT_STATUS_OPTIONS };
  }
  return {};
}
