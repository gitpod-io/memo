import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TableColumnHeader } from "./table-column-header";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ts = "2026-04-01T00:00:00Z";

const textProp: DatabaseProperty = {
  id: "prop-name",
  database_id: "db-1",
  name: "Name",
  type: "text",
  config: {},
  position: 0,
  created_at: ts,
  updated_at: ts,
};

const selectProp: DatabaseProperty = {
  id: "prop-status",
  database_id: "db-1",
  name: "Status",
  type: "select",
  config: {},
  position: 1,
  created_at: ts,
  updated_at: ts,
};

const dateProp: DatabaseProperty = {
  id: "prop-due",
  database_id: "db-1",
  name: "Due Date",
  type: "date",
  config: {},
  position: 2,
  created_at: ts,
  updated_at: ts,
};

const defaultHandlers = {
  onDragStart: fn(),
  onDragEnd: fn(),
  onDragOver: fn(),
  onDrop: fn(),
  onResizeStart: fn(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableColumnHeader> = {
  title: "Database/TableColumnHeader",
  component: TableColumnHeader,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-48 bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    colIndex: 0,
    sortRule: undefined,
    isDragging: false,
    showDropBefore: false,
    showDropAfter: false,
    resizingColumn: null,
    ...defaultHandlers,
  },
};

export { meta as default };

type Story = StoryObj<typeof TableColumnHeader>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    property: textProp,
  },
};

export const WithSortAsc: Story = {
  name: "Sorted ascending",
  args: {
    property: selectProp,
    sortRule: { property_id: selectProp.id, direction: "asc" },
    onSortToggle: fn(),
  },
};

export const WithSortDesc: Story = {
  name: "Sorted descending",
  args: {
    property: selectProp,
    sortRule: { property_id: selectProp.id, direction: "desc" },
    onSortToggle: fn(),
  },
};

export const WithMenu: Story = {
  name: "With column menu",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
};

export const MenuRenameOnly: Story = {
  name: "Menu (rename only)",
  args: {
    property: dateProp,
    onColumnHeaderClick: fn(),
  },
};

export const Dragging: Story = {
  name: "Dragging state",
  args: {
    property: textProp,
    isDragging: true,
    onColumnReorder: fn(),
  },
};

export const DropIndicatorBefore: Story = {
  name: "Drop indicator (before)",
  args: {
    property: selectProp,
    showDropBefore: true,
  },
};

export const DropIndicatorAfter: Story = {
  name: "Drop indicator (after)",
  args: {
    property: selectProp,
    showDropAfter: true,
  },
};

export const Resizing: Story = {
  name: "Resize handle active",
  args: {
    property: textProp,
    resizingColumn: textProp.id,
  },
};

export const Draggable: Story = {
  name: "Draggable (cursor grab)",
  args: {
    property: textProp,
    onColumnReorder: fn(),
  },
};

export const TitleColumn: Story = {
  name: "Title column (position 0, no delete)",
  args: {
    property: textProp,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
};
