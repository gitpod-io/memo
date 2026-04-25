import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ListView } from "./list-view";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data (matches table-view stories for consistency)
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
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
  }),
  makeRow("row-2", "API authentication", "🔐", {
    "prop-status": { value: "Done", color: "green" },
    "prop-priority": { value: "High", color: "red" },
    "prop-due": { value: "2026-04-15" },
    "prop-url": { value: "https://example.com/auth" },
    "prop-done": { value: true },
  }),
  makeRow("row-3", "Database migrations", null, {
    "prop-status": { value: "To Do", color: "gray" },
    "prop-priority": { value: "Medium", color: "yellow" },
    "prop-due": { value: "2026-05-10" },
    "prop-done": { value: false },
  }),
  makeRow("row-4", "User onboarding flow", "🚀", {
    "prop-status": { value: "In Review", color: "purple" },
    "prop-priority": { value: "Low", color: "blue" },
    "prop-due": { value: "2026-05-01" },
    "prop-url": { value: "https://example.com/onboarding" },
    "prop-done": { value: false },
  }),
  makeRow("row-5", "Performance optimization", "⚡", {
    "prop-status": { value: "In Progress", color: "blue" },
    "prop-priority": { value: "High", color: "red" },
    "prop-due": { value: "2026-04-25" },
    "prop-done": { value: false },
  }),
  makeRow("row-6", "", null, {
    "prop-status": { value: "To Do", color: "gray" },
    "prop-done": { value: false },
  }),
];

const defaultConfig: DatabaseViewConfig = {};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ListView> = {
  title: "Database/ListView",
  component: ListView,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    workspaceSlug: "my-workspace",
    onAddRow: fn(),
    onNavigate: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof ListView>;

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

export const Loading: Story = {
  args: {
    rows: [],
    properties: mockProperties,
    viewConfig: defaultConfig,
    loading: true,
  },
};

export const WithVisibleProperties: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: {
      visible_properties: ["prop-status", "prop-due"],
    },
  },
};

export const NoProperties: Story = {
  args: {
    rows: mockRows,
    properties: [],
    viewConfig: defaultConfig,
  },
};

export const SingleRow: Story = {
  args: {
    rows: [mockRows[0]],
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

export const ManyRows: Story = {
  args: {
    rows: [
      ...mockRows,
      makeRow("row-7", "Search indexing", "🔍", {
        "prop-status": { value: "To Do", color: "gray" },
        "prop-priority": { value: "Medium", color: "yellow" },
        "prop-due": { value: "2026-05-15" },
        "prop-done": { value: false },
      }),
      makeRow("row-8", "Email notifications", "📧", {
        "prop-status": { value: "Done", color: "green" },
        "prop-priority": { value: "Low", color: "blue" },
        "prop-due": { value: "2026-04-10" },
        "prop-done": { value: true },
      }),
      makeRow("row-9", "Mobile responsive layout", "📱", {
        "prop-status": { value: "In Progress", color: "blue" },
        "prop-priority": { value: "High", color: "red" },
        "prop-due": { value: "2026-05-20" },
        "prop-done": { value: false },
      }),
      makeRow("row-10", "Data export feature", "📊", {
        "prop-status": { value: "To Do", color: "gray" },
        "prop-priority": { value: "Medium", color: "yellow" },
        "prop-done": { value: false },
      }),
    ],
    properties: mockProperties,
    viewConfig: {
      visible_properties: ["prop-status", "prop-priority", "prop-due"],
    },
  },
};

export const KeyboardNavigation: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: defaultConfig,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tab to a row to focus it. Use ↑/↓ to move between rows. Home/End jump to first/last row. Enter opens the row. Escape clears focus. Focused rows show a ring-2 ring-ring focus ring.",
      },
    },
  },
};
