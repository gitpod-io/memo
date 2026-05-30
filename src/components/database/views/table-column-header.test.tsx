import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableColumnHeader } from "./table-column-header";
import type { DatabaseProperty } from "@/lib/types";

const ts = "2026-01-01T00:00:00Z";

const textProp: DatabaseProperty = {
  id: "prop-name",
  database_id: "db-1",
  name: "Name",
  type: "text",
  config: {},
  position: 1,
  created_at: ts,
  updated_at: ts,
};

const noop = vi.fn();

const baseProps = {
  property: textProp,
  colIndex: 0,
  sortRule: undefined,
  isDragging: false,
  showDropBefore: false,
  showDropAfter: false,
  resizingColumn: null,
  onDragStart: noop,
  onDragEnd: noop,
  onDragOver: noop,
  onDrop: noop,
  onResizeStart: noop,
};

describe("TableColumnHeader aria-sort", () => {
  it('sets aria-sort="none" when no sort rule is active', () => {
    render(<TableColumnHeader {...baseProps} sortRule={undefined} />);
    const header = screen.getByRole("columnheader");
    expect(header.getAttribute("aria-sort")).toBe("none");
  });

  it('sets aria-sort="ascending" when sorted ascending', () => {
    render(
      <TableColumnHeader
        {...baseProps}
        sortRule={{ property_id: textProp.id, direction: "asc" }}
        onSortToggle={noop}
      />,
    );
    const header = screen.getByRole("columnheader");
    expect(header.getAttribute("aria-sort")).toBe("ascending");
  });

  it('sets aria-sort="descending" when sorted descending', () => {
    render(
      <TableColumnHeader
        {...baseProps}
        sortRule={{ property_id: textProp.id, direction: "desc" }}
        onSortToggle={noop}
      />,
    );
    const header = screen.getByRole("columnheader");
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });
});
