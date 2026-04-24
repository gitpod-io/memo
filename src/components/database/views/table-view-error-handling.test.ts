/**
 * Regression tests for #686: table-view inline editing error capture.
 *
 * Verifies that table-view.tsx and database-view-client.tsx have the
 * required error handling for cell editing operations:
 * - try-catch around onBlur callbacks in TableCell and RegistryEditorCell
 * - CellEditorErrorBoundary wrapping portal and non-portal editors
 * - Sentry capture calls in error paths
 * - Optimistic rollback on save failure in handleCellUpdate
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const tableViewSource = readFileSync(
  join(__dirname, "table-view.tsx"),
  "utf-8",
);

const dbViewClientSource = readFileSync(
  join(__dirname, "..", "database-view-client.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// table-view.tsx error handling
// ---------------------------------------------------------------------------

describe("table-view cell edit error capture", () => {
  it("imports lazyCaptureException from @/lib/capture", () => {
    expect(tableViewSource).toMatch(
      /import\s*\{[^}]*lazyCaptureException[^}]*\}\s*from\s*["']@\/lib\/capture["']/,
    );
  });

  it("imports toast from sonner", () => {
    expect(tableViewSource).toMatch(
      /import\s*\{[^}]*toast[^}]*\}\s*from\s*["']sonner["']/,
    );
  });

  it("wraps cell-edit-save onBlur with try-catch and Sentry capture", () => {
    expect(tableViewSource).toContain("table-view:cell-edit-save");
  });

  it("wraps checkbox toggle with try-catch and Sentry capture", () => {
    expect(tableViewSource).toContain("table-view:checkbox-toggle");
  });

  it("wraps registry editor change with try-catch and Sentry capture", () => {
    expect(tableViewSource).toContain("table-view:registry-editor-change");
  });

  it("wraps registry editor blur with try-catch and Sentry capture", () => {
    expect(tableViewSource).toContain("table-view:registry-editor-blur");
  });

  it("shows toast on cell edit failure", () => {
    // All error paths should show a user-visible toast
    const matches = tableViewSource.match(/toast\.error\("Failed to save cell edit"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// CellEditorErrorBoundary
// ---------------------------------------------------------------------------

describe("CellEditorErrorBoundary", () => {
  it("defines a CellEditorErrorBoundary class component", () => {
    expect(tableViewSource).toContain("class CellEditorErrorBoundary");
  });

  it("captures rendering errors to Sentry with operation tag", () => {
    expect(tableViewSource).toContain("table-view:cell-editor-render");
  });

  it("shows toast when editor fails to render", () => {
    expect(tableViewSource).toContain("Cell editor failed to render");
  });

  it("wraps portal editor content in the error boundary", () => {
    // The createPortal call should contain CellEditorErrorBoundary
    expect(tableViewSource).toMatch(
      /createPortal\(\s*<CellEditorErrorBoundary/,
    );
  });

  it("wraps non-portal editor content in the error boundary", () => {
    // The non-portal return path should also use the error boundary
    const nonPortalBoundaryCount = (
      tableViewSource.match(/<CellEditorErrorBoundary/g) ?? []
    ).length;
    // At least 2: one for portal, one for non-portal
    expect(nonPortalBoundaryCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// database-view-client.tsx optimistic rollback
// ---------------------------------------------------------------------------

describe("database-view-client handleCellUpdate rollback", () => {
  it("snapshots previous rows state before optimistic update", () => {
    expect(dbViewClientSource).toContain("prevRows");
  });

  it("snapshots previous properties state before optimistic update", () => {
    expect(dbViewClientSource).toContain("prevProperties");
  });

  it("reverts rows on save failure", () => {
    expect(dbViewClientSource).toContain("if (prevRows) setRows(prevRows)");
  });

  it("reverts properties on save failure", () => {
    expect(dbViewClientSource).toContain(
      "if (prevProperties) setProperties(prevProperties)",
    );
  });
});
