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
    // Must contain addProperty(pageId, name, type) — using the parameter.
    expect(viewClient).toMatch(/addProperty\(\s*pageId\s*,\s*name\s*,\s*type\s*\)/);
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
