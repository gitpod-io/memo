import { describe, it, expect } from "vitest";
import {
  STANDARD_PROPERTY_TYPES,
  ADVANCED_PROPERTY_TYPES,
  getPropertyTypeConfig,
} from "./property-types";
import { PROPERTY_TYPE_ICON, PROPERTY_TYPE_LABEL } from "@/lib/property-icons";
import type { PropertyType } from "@/lib/types";

/**
 * Regression test for issue #585: files and relation property types were
 * registered in the renderer/editor registry but missing from the picker
 * arrays, making them impossible to create from the UI.
 */
describe("property type picker completeness (#585)", () => {
  const allPickerTypes: readonly PropertyType[] = [
    ...STANDARD_PROPERTY_TYPES,
    ...ADVANCED_PROPERTY_TYPES,
  ];

  it("includes 'files' in the picker", () => {
    expect(allPickerTypes).toContain("files");
  });

  it("includes 'relation' in the picker", () => {
    expect(allPickerTypes).toContain("relation");
  });

  it("every registered property type with an editor is in the picker", () => {
    // All types that have a renderer+editor in the registry should be
    // selectable in the picker. Read-only computed types (Editor: null)
    // are included in the advanced section.
    const allPropertyTypes: PropertyType[] = [
      "text",
      "number",
      "select",
      "multi_select",
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

    for (const type of allPropertyTypes) {
      const config = getPropertyTypeConfig(type);
      if (config) {
        expect(
          allPickerTypes,
          `registered type "${type}" should be in STANDARD or ADVANCED arrays`,
        ).toContain(type);
      }
    }
  });

  it("every picker type has an icon and label", () => {
    for (const type of allPickerTypes) {
      expect(
        PROPERTY_TYPE_ICON[type],
        `missing icon for "${type}"`,
      ).toBeDefined();
      expect(
        PROPERTY_TYPE_LABEL[type],
        `missing label for "${type}"`,
      ).toBeDefined();
    }
  });

  it("has no duplicate types across standard and advanced arrays", () => {
    const seen = new Set<string>();
    for (const type of allPickerTypes) {
      expect(seen.has(type), `duplicate type "${type}" in picker arrays`).toBe(
        false,
      );
      seen.add(type);
    }
  });
});
