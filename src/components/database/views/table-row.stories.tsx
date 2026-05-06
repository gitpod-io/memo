import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TableRow } from "./table-row";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ts = "2026-04-01T00:00:00Z";

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: {
      options: [
        { id: "opt-todo", name: "To Do", color: "gray" },
        { id: "opt-doing", name: "In Progress", color: "blue" },
        { id: "opt-done", name: "Done", color: "green" },
      ],
    },
    position: 1,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: "prop-due",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 2,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: "prop-done",
    database_id: "db-1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: 3,
    created_at: ts,
    updated_at: ts,
  },
];

function makeRow(
  id: string,
  title: string,
  icon: string | null,
  values: Record<string, Record<string, unknown>>,
): DatabaseRow {
  const rowValues: DatabaseRow["values"] = {};
  for (const [propId, val] of Object.entries(values)) {
    rowValues[propId] = {
      id: `rv-${id}-${propId}`,
      row_id: id,
      property_id: propId,
      value: val,
      created_at: ts,
      updated_at: ts,
    };
  }
  return {
    page: {
      id,
      title,
      icon,
      cover_url: null,
      created_at: ts,
      updated_at: "2026-04-15T00:00:00Z",
      created_by: "user-1",
    },
    values: rowValues,
  };
}

const defaultRow = makeRow("row-1", "Design system tokens", "🎨", {
  "prop-status": { option_id: "opt-doing" },
  "prop-due": { date: "2026-04-30" },
  "prop-done": { checked: false },
});

const untitledRow = makeRow("row-2", "", null, {
  "prop-status": { option_id: "opt-todo" },
  "prop-done": { checked: false },
});

const defaultHandlers = {
  onStartEditing: fn(),
  onCellKeyDown: fn(),
  onCellBlur: fn(),
  onCellFocus: fn(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableRow> = {
  title: "Database/TableRow",
  component: TableRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        className="max-w-3xl bg-background"
        role="grid"
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(200px, 1fr) ${mockProperties.map(() => "150px").join(" ")} 40px`,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    rowIndex: 0,
    visibleProperties: mockProperties,
    allProperties: mockProperties,
    rowHeightClass: "h-9",
    workspaceSlug: "my-workspace",
    editingCell: null,
    focusedCell: null,
    ...defaultHandlers,
  },
};

export { meta as default };

type Story = StoryObj<typeof TableRow>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    row: defaultRow,
  },
};

export const WithDeleteButton: Story = {
  name: "With delete button (hover to see)",
  args: {
    row: defaultRow,
    onDeleteRow: fn(),
  },
};

export const UntitledRow: Story = {
  name: "Untitled row",
  args: {
    row: untitledRow,
  },
};

export const CompactHeight: Story = {
  name: "Compact row height",
  args: {
    row: defaultRow,
    rowHeightClass: "h-7",
  },
};

export const TallHeight: Story = {
  name: "Tall row height",
  args: {
    row: defaultRow,
    rowHeightClass: "h-12",
  },
};

export const WithEditingCell: Story = {
  name: "Cell in editing state",
  args: {
    row: defaultRow,
    editingCell: { rowId: "row-1", propertyId: "prop-due" },
  },
};

export const WithFocusedCell: Story = {
  name: "Cell in focused state",
  args: {
    row: defaultRow,
    focusedCell: { rowIndex: 0, colIndex: 1 },
  },
};

export const WithSelectionCheckbox: Story = {
  name: "With selection checkbox (unselected)",
  decorators: [
    (Story) => (
      <div
        className="max-w-3xl bg-background"
        role="grid"
        style={{
          display: "grid",
          gridTemplateColumns: `32px minmax(200px, 1fr) ${mockProperties.map(() => "150px").join(" ")} 40px`,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    row: defaultRow,
    onToggleSelect: fn(),
    isSelected: false,
  },
};

export const SelectedRow: Story = {
  name: "Selected row",
  decorators: [
    (Story) => (
      <div
        className="max-w-3xl bg-background"
        role="grid"
        style={{
          display: "grid",
          gridTemplateColumns: `32px minmax(200px, 1fr) ${mockProperties.map(() => "150px").join(" ")} 40px`,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    row: defaultRow,
    onToggleSelect: fn(),
    isSelected: true,
  },
};
