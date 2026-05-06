import { describe, it, expect } from "vitest";
import { remapViewConfig } from "./database";
import type { DatabaseViewConfig } from "@/lib/types";

describe("remapViewConfig", () => {
  const propertyMap = new Map([
    ["old-prop-1", "new-prop-1"],
    ["old-prop-2", "new-prop-2"],
    ["old-prop-3", "new-prop-3"],
  ]);

  it("remaps visible_properties", () => {
    const config: DatabaseViewConfig = {
      visible_properties: ["old-prop-1", "old-prop-2"],
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.visible_properties).toEqual(["new-prop-1", "new-prop-2"]);
  });

  it("remaps sorts property_id", () => {
    const config: DatabaseViewConfig = {
      sorts: [
        { property_id: "old-prop-1", direction: "asc" },
        { property_id: "old-prop-3", direction: "desc" },
      ],
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.sorts).toEqual([
      { property_id: "new-prop-1", direction: "asc" },
      { property_id: "new-prop-3", direction: "desc" },
    ]);
  });

  it("remaps filters property_id", () => {
    const config: DatabaseViewConfig = {
      filters: [
        { property_id: "old-prop-2", operator: "equals", value: "test" },
      ],
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.filters).toEqual([
      { property_id: "new-prop-2", operator: "equals", value: "test" },
    ]);
  });

  it("remaps column_widths keys", () => {
    const config: DatabaseViewConfig = {
      column_widths: { "old-prop-1": 200, "old-prop-2": 150 },
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.column_widths).toEqual({
      "new-prop-1": 200,
      "new-prop-2": 150,
    });
  });

  it("remaps group_by", () => {
    const config: DatabaseViewConfig = {
      group_by: "old-prop-1",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.group_by).toBe("new-prop-1");
  });

  it("remaps date_property", () => {
    const config: DatabaseViewConfig = {
      date_property: "old-prop-2",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.date_property).toBe("new-prop-2");
  });

  it("remaps cover_property", () => {
    const config: DatabaseViewConfig = {
      cover_property: "old-prop-3",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.cover_property).toBe("new-prop-3");
  });

  it("preserves unmapped property IDs", () => {
    const config: DatabaseViewConfig = {
      visible_properties: ["old-prop-1", "unknown-prop"],
      group_by: "unknown-group",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.visible_properties).toEqual(["new-prop-1", "unknown-prop"]);
    expect(result.group_by).toBe("unknown-group");
  });

  it("preserves non-property config fields", () => {
    const config: DatabaseViewConfig = {
      row_height: "compact",
      hide_empty_groups: true,
      card_size: "medium",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result.row_height).toBe("compact");
    expect(result.hide_empty_groups).toBe(true);
    expect(result.card_size).toBe("medium");
  });

  it("handles empty config", () => {
    const config: DatabaseViewConfig = {};
    const result = remapViewConfig(config, propertyMap);
    expect(result).toEqual({});
  });

  it("handles all fields together", () => {
    const config: DatabaseViewConfig = {
      visible_properties: ["old-prop-1", "old-prop-2"],
      sorts: [{ property_id: "old-prop-1", direction: "asc" }],
      filters: [{ property_id: "old-prop-3", operator: "contains", value: "x" }],
      column_widths: { "old-prop-1": 300 },
      group_by: "old-prop-2",
      date_property: "old-prop-3",
      cover_property: "old-prop-1",
      row_height: "tall",
    };
    const result = remapViewConfig(config, propertyMap);
    expect(result).toEqual({
      visible_properties: ["new-prop-1", "new-prop-2"],
      sorts: [{ property_id: "new-prop-1", direction: "asc" }],
      filters: [{ property_id: "new-prop-3", operator: "contains", value: "x" }],
      column_widths: { "new-prop-1": 300 },
      group_by: "new-prop-2",
      date_property: "new-prop-3",
      cover_property: "new-prop-1",
      row_height: "tall",
    });
  });
});
