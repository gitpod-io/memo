import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TableView } from "./table-view";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-title",
    database_id: "db-1",
    name: "Name",
    type: "text",
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-priority",
    database_id: "db-1",
    name: "Priority",
    type: "select",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-due",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 3,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-url",
    database_id: "db-1",
    name: "Link",
    type: "url",
    config: {},
    position: 4,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-done",
    database_id: "db-1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: 5,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-stage",
    database_id: "db-1",
    name: "Stage",
    type: "status",
    config: {},
    position: 6,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
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
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    };
  }
  return {
    page: {
      id,
      title,
      icon,
      cover_url: null,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-15T00:00:00Z",
      created_by: "user-1",
    },
    values: rowValues,
  };
}

const mockRows: DatabaseRow[] = [
  makeRow("row-1", "Design system tokens", "🎨", {
    "prop-status": { value: "In Progress", color: "blue" },
    "prop-priority": { value: "High", color: "red" },
    "prop-due": { value: "2026-04-30" },
    "prop-url": { value: "https://example.com/design" },
    "prop-done": { value: false },
    "prop-stage": { option_id: "status-in-progress" },
  }),
  makeRow("row-2", "API authentication", "🔐", {
    "prop-status": { value: "Done", color: "green" },
    "prop-priority": { value: "High", color: "red" },
    "prop-due": { value: "2026-04-15" },
    "prop-url": { value: "https://example.com/auth" },
    "prop-done": { value: true },
    "prop-stage": { option_id: "status-done" },
  }),
  makeRow("row-3", "Database migrations", null, {
    "prop-status": { value: "To Do", color: "gray" },
    "prop-priority": { value: "Medium", color: "yellow" },
    "prop-due": { value: "2026-05-10" },
    "prop-done": { value: false },
    "prop-stage": { option_id: "status-not-started" },
  }),
  makeRow("row-4", "User onboarding flow", "🚀", {
    "prop-status": { value: "In Review", color: "purple" },
    "prop-priority": { value: "Low", color: "blue" },
    "prop-due": { value: "2026-05-01" },
    "prop-url": { value: "https://example.com/onboarding" },
    "prop-done": { value: false },
    "prop-stage": { option_id: "status-in-progress" },
  }),
  makeRow("row-5", "", null, {
    "prop-status": { value: "To Do", color: "gray" },
    "prop-priority": { value: "Medium", color: "yellow" },
    "prop-done": { value: false },
  }),
];

const defaultConfig: DatabaseViewConfig = {};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableView> = {
  title: "Database/TableView",
  component: TableView,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-5xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    workspaceSlug: "my-workspace",
    onCellUpdate: fn(),
    onAddRow: fn(),
    onAddColumn: fn(),
    onColumnWidthsChange: fn(),
    onColumnHeaderClick: fn(),
    onColumnReorder: fn(),
    onDeleteColumn: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof TableView>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const Empty: Story = {
  args: {
    rows: [],
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const FilteredEmpty: Story = {
  args: {
    rows: [],
    properties: mockProperties,
    viewConfig: defaultConfig,
    hasActiveFilters: true,
    onClearFilters: fn(),
  },
};

export const Loading: Story = {
  args: {
    rows: [],
    properties: mockProperties,
    viewConfig: defaultConfig,
    loading: true,
  },
};

export const CompactRowHeight: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: { row_height: "compact" },
  },
};

export const TallRowHeight: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: { row_height: "tall" },
  },
};

export const CustomColumnWidths: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: {
      column_widths: {
        "prop-status": 120,
        "prop-priority": 100,
        "prop-due": 140,
        "prop-url": 250,
        "prop-done": 80,
      },
    },
  },
};

export const FewColumns: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties.slice(0, 2),
    viewConfig: defaultConfig,
  },
};

export const ManyColumns: Story = {
  args: {
    rows: mockRows,
    properties: [
      ...mockProperties,
      {
        id: "prop-email",
        database_id: "db-1",
        name: "Email",
        type: "email" as const,
        config: {},
        position: 6,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "prop-phone",
        database_id: "db-1",
        name: "Phone",
        type: "phone" as const,
        config: {},
        position: 7,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "prop-number",
        database_id: "db-1",
        name: "Score",
        type: "number" as const,
        config: {},
        position: 8,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
    ],
    viewConfig: defaultConfig,
  },
};

export const ReadOnlyNoActions: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onAddRow: undefined,
    onAddColumn: undefined,
    onCellUpdate: undefined,
    onColumnHeaderClick: undefined,
    onColumnWidthsChange: undefined,
  },
};

export const SingleRow: Story = {
  args: {
    rows: [mockRows[0]],
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const ColumnReorder: Story = {
  name: "Column Reorder (drag headers)",
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onColumnReorder: fn(),
  },
};

export const ColumnReorderDisabled: Story = {
  name: "Column Reorder Disabled",
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onColumnReorder: undefined,
  },
};

export const WithColumnMenu: Story = {
  name: "Column Header Menu (rename + delete)",
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onColumnHeaderClick: fn(),
    onDeleteColumn: fn(),
  },
};

export const ColumnMenuNoDelete: Story = {
  name: "Column Header Menu (rename only)",
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onColumnHeaderClick: fn(),
    onDeleteColumn: undefined,
  },
};

export const Mobile: Story = {
  name: "Mobile (375px)",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [
    (Story) => (
      <div className="w-[375px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const Tablet: Story = {
  name: "Tablet (768px)",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  decorators: [
    (Story) => (
      <div className="w-[768px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};
