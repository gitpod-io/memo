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

/**
 * Concatenates all migration SQL in order to simulate the final schema state.
 */
function getAllMigrationsSql(): string {
  return getMigrationFiles()
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf-8"))
    .join("\n");
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

/**
 * Regression test for issue #595: page_versions.created_by FK lacked
 * ON DELETE SET NULL, causing delete_account RPC to fail with a FK violation.
 *
 * Verifies that the final migration state includes the fix.
 */
describe("delete_account RPC handles all user-referencing tables", () => {
  const allSql = getAllMigrationsSql();

  it("page_versions.created_by FK uses ON DELETE SET NULL", () => {
    // The fix migration must re-add the constraint with on delete set null
    expect(allSql).toContain(
      "foreign key (created_by) references public.profiles(id) on delete set null"
    );
  });

  it("delete_account RPC nullifies page_versions before deleting profile", () => {
    // The updated RPC must handle page_versions explicitly
    expect(allSql).toMatch(
      /update public\.page_versions\s+set created_by = null/
    );
  });

  it("delete_account RPC handles tables added after original RPC", () => {
    // Tables added after the original delete_account RPC was written
    const tablesHandled = ["favorites", "page_visits", "user_feedback", "usage_events"];
    for (const table of tablesHandled) {
      expect(allSql).toMatch(
        new RegExp(`delete from public\\.${table}\\s+where user_id = _user_id`)
      );
    }
  });
});
