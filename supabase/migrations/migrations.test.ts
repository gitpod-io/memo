import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";

/**
 * Regression test for issue #315: an empty migration file was committed,
 * causing PGRST205 errors because the table was never created.
 *
 * Every .sql migration file must contain at least one SQL statement.
 */

const migrationsDir = resolve(__dirname);

function getMigrationFiles(): string[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
}

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "") // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .trim();
}

describe("database migrations", () => {
  const files = getMigrationFiles();

  it("has at least one migration file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains SQL statements", (filename) => {
    const content = readFileSync(join(migrationsDir, filename), "utf-8");
    const sql = stripComments(content);
    expect(sql.length).toBeGreaterThan(0);
  });
});
