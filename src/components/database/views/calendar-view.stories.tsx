import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { CalendarView } from "./calendar-view";
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
    id: "prop-due",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
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
    config: {
      options: [
        { id: "opt-todo", name: "To Do", color: "gray" },
        { id: "opt-done", name: "Done", color: "green" },
      ],
    },
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-title-text",
    database_id: "db-1",
    name: "Notes",
    type: "text",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

function makeRow(
  id: string,
  title: string,
  icon: string | null,
  date: string | null,
): DatabaseRow {
  const values: DatabaseRow["values"] = {};
  if (date) {
    values["prop-due"] = {
      id: `rv-${id}-due`,
      row_id: id,
      property_id: "prop-due",
      value: { date },
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
    values,
  };
}

// Items spread across April 2026
const mockRows: DatabaseRow[] = [
  makeRow("row-1", "Design review", "🎨", "2026-04-03"),
  makeRow("row-2", "Sprint planning", "📋", "2026-04-07"),
  makeRow("row-3", "API deadline", "🔐", "2026-04-07"),
  makeRow("row-4", "Team standup", null, "2026-04-14"),
  makeRow("row-5", "Release v2.0", "🚀", "2026-04-21"),
  makeRow("row-6", "Bug bash", "🐛", "2026-04-21"),
  makeRow("row-7", "Retrospective", null, "2026-04-28"),
  makeRow("row-8", "No date task", "📝", null),
];

// Items for overflow testing — 5 items on the same day
const overflowRows: DatabaseRow[] = [
  makeRow("of-1", "Meeting 1", null, "2026-04-15"),
  makeRow("of-2", "Meeting 2", null, "2026-04-15"),
  makeRow("of-3", "Meeting 3", null, "2026-04-15"),
  makeRow("of-4", "Meeting 4", null, "2026-04-15"),
  makeRow("of-5", "Meeting 5", null, "2026-04-15"),
  makeRow("of-6", "Other task", "📌", "2026-04-20"),
];

const defaultConfig: DatabaseViewConfig = {
  date_property: "prop-due",
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CalendarView> = {
  title: "Database/CalendarView",
  component: CalendarView,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    workspaceSlug: "my-workspace",
    onAddRow: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof CalendarView>;

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

export const NoDatePropertyConfigured: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: {},
  },
};

export const NoDatePropertiesExist: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties.filter((p) => p.type !== "date"),
    viewConfig: {},
  },
};

export const WithOverflow: Story = {
  args: {
    rows: overflowRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const ManyItems: Story = {
  args: {
    rows: [
      ...mockRows,
      ...Array.from({ length: 12 }, (_, i) =>
        makeRow(
          `row-extra-${i}`,
          `Task ${i + 1}`,
          null,
          `2026-04-${String((i % 28) + 1).padStart(2, "0")}`,
        ),
      ),
    ],
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
};

export const ReadOnlyNoActions: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
    onAddRow: undefined,
  },
};
