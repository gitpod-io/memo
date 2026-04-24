import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #538: property type selector when creating columns.
 *
 * The bug was that addProperty was called with a hardcoded "text" type instead
 * of letting the user choose. This test ensures the handleAddColumn callback
 * accepts a PropertyType parameter and passes it through to addProperty.
 */

function readViewClient(): string {
  return readFileSync(
    resolve(__dirname, "./database-view-client.tsx"),
    "utf-8",
  );
}

function readTableView(): string {
  return readFileSync(
    resolve(__dirname, "./views/table-view.tsx"),
    "utf-8",
  );
}

function readTableCell(): string {
  return readFileSync(
    resolve(__dirname, "./views/table-cell.tsx"),
    "utf-8",
  );
}

function readPropertyTypePicker(): string {
  return readFileSync(
    resolve(__dirname, "./property-type-picker.tsx"),
    "utf-8",
  );
}

describe("property type selector regression (#538)", () => {
  const viewClient = readViewClient();

  it("handleAddColumn accepts a type parameter", () => {
    // The callback must accept a PropertyType, not be a zero-arg function.
    expect(viewClient).toMatch(/handleAddColumn[^]*?async\s*\(\s*type\s*:\s*PropertyType\s*\)/);
  });

  it("addProperty is called with the type parameter, not a hardcoded string", () => {
    // Must NOT contain addProperty(pageId, name, "text") — the type should be dynamic.
    const hardcodedCall = /addProperty\(\s*pageId\s*,\s*name\s*,\s*"text"\s*\)/;
    expect(viewClient).not.toMatch(hardcodedCall);
  });

  it("addProperty is called with the dynamic type variable", () => {
    // Must contain addProperty(pageId, name, type, ...) — using the parameter.
    expect(viewClient).toMatch(/addProperty\(\s*pageId\s*,\s*name\s*,\s*type\b/);
  });

  it("table view uses PropertyTypePicker for add-column", () => {
    const tableView = readTableView();
    expect(tableView).toContain("PropertyTypePicker");
  });

  it("table view onAddColumn accepts a PropertyType parameter", () => {
    const tableView = readTableView();
    expect(tableView).toMatch(/onAddColumn\?\s*:\s*\(\s*type\s*:\s*PropertyType\s*\)/);
  });
});

/**
 * Regression test for issue #563: default column name should match the selected
 * property type instead of using a generic "Property N" name.
 *
 * The naming logic was extracted to column-helpers.ts (generateColumnName).
 * These tests verify the view client uses the extracted helper.
 */
describe("default column name matches property type (#563)", () => {
  const viewClient = readViewClient();

  it("imports generateColumnName from column-helpers", () => {
    expect(viewClient).toContain("generateColumnName");
    expect(viewClient).toMatch(
      /import\s*\{[^}]*generateColumnName[^}]*\}\s*from\s*["']@\/lib\/column-helpers["']/,
    );
  });

  it("does not use the generic 'Property N' naming pattern", () => {
    // The old pattern: `Property ${properties.length + 1}`
    expect(viewClient).not.toMatch(/`Property \$\{properties\.length/);
  });

  it("calls generateColumnName to derive the column name", () => {
    expect(viewClient).toMatch(/generateColumnName\s*\(/);
  });

  it("calls getDefaultColumnConfig to derive the column config", () => {
    expect(viewClient).toContain("getDefaultColumnConfig");
    expect(viewClient).toMatch(/getDefaultColumnConfig\s*\(/);
  });
});

/**
 * Regression test for issue #563: date cells in table view should use the
 * DateEditor (calendar picker) instead of a plain text input.
 */
describe("table view uses registry editors for specialized types (#563)", () => {
  // Cell editing logic was extracted from table-view.tsx to table-cell.tsx
  const tableCell = readTableCell();

  it("uses getPropertyTypeConfig to look up editors in the editing path", () => {
    expect(tableCell).toMatch(/getPropertyTypeConfig\(propertyType\)/);
  });

  it("renders a RegistryEditorCell for non-text-input types", () => {
    expect(tableCell).toContain("RegistryEditorCell");
  });

  it("does not use plain input for date type editing", () => {
    // The plain-input exclusion list only includes text, number, url, email, phone.
    // Date is NOT excluded, so it uses the registry editor (DateEditor / calendar picker).
    const plainInputTypes = tableCell.match(
      /hasRegistryEditor\s*=[\s\S]+?;/,
    )?.[0];
    expect(plainInputTypes).toBeDefined();
    // date should NOT be in the plain-input exclusion list
    expect(plainInputTypes).not.toContain('"date"');
  });

  it("RegistryEditorCell passes value, property, onChange, and onBlur to Editor", () => {
    expect(tableCell).toMatch(/<Editor[\s\S]*?value=\{/);
    expect(tableCell).toMatch(/<Editor[\s\S]*?property=\{property\}/);
    expect(tableCell).toMatch(/<Editor[\s\S]*?onChange=\{/);
    expect(tableCell).toMatch(/<Editor[\s\S]*?onBlur=\{/);
  });
});

/**
 * Regression test for issue #547 / Sentry MEMO-1E: DropdownMenuLabel must be
 * inside DropdownMenuGroup.
 *
 * DropdownMenuLabel renders Base UI's Menu.GroupLabel, which requires a
 * Menu.Group ancestor. When placed outside, Base UI throws error #31
 * ("MenuGroupRootContext is missing").
 */
describe("DropdownMenuLabel inside DropdownMenuGroup (#547)", () => {
  const source = readPropertyTypePicker();

  it("every DropdownMenuLabel is preceded by a DropdownMenuGroup open tag (not a close tag)", () => {
    // Find every <DropdownMenuLabel and check that the closest preceding
    // DropdownMenuGroup tag is an opening tag, not a closing tag.
    const labelPattern = /<DropdownMenuLabel/g;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = labelPattern.exec(source)) !== null) {
      count++;
      const before = source.slice(0, match.index);
      const lastOpen = before.lastIndexOf("<DropdownMenuGroup");
      const lastClose = before.lastIndexOf("</DropdownMenuGroup");

      expect(lastOpen).toBeGreaterThan(
        lastClose,
      );
    }

    // Sanity: we found at least one label
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
