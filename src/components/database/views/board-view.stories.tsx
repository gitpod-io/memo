import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BoardView } from "./board-view";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  SelectOption,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const statusOptions: SelectOption[] = [
  { id: "opt-todo", name: "To Do", color: "gray" },
  { id: "opt-progress", name: "In Progress", color: "blue" },
  { id: "opt-review", name: "In Review", color: "purple" },
  { id: "opt-done", name: "Done", color: "green" },
];

const priorityOptions: SelectOption[] = [
  { id: "opt-high", name: "High", color: "red" },
  { id: "opt-medium", name: "Medium", color: "yellow" },
  { id: "opt-low", name: "Low", color: "blue" },
];

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: { options: statusOptions },
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-priority",
    database_id: "db-1",
    name: "Priority",
    type: "select",
    config: { options: priorityOptions },
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-due",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-assignee",
    database_id: "db-1",
    name: "Assignee",
    type: "text",
    config: {},
    position: 3,
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
    "prop-status": { option_id: "opt-progress" },
    "prop-priority": { option_id: "opt-high" },
    "prop-due": { value: "2026-04-30" },
    "prop-assignee": { value: "Alice" },
  }),
  makeRow("row-2", "API authentication", "🔐", {
    "prop-status": { option_id: "opt-done" },
    "prop-priority": { option_id: "opt-high" },
    "prop-due": { value: "2026-04-15" },
    "prop-assignee": { value: "Bob" },
  }),
  makeRow("row-3", "Database migrations", null, {
    "prop-status": { option_id: "opt-todo" },
    "prop-priority": { option_id: "opt-medium" },
    "prop-due": { value: "2026-05-10" },
  }),
  makeRow("row-4", "User onboarding flow with a longer title that should be truncated to two lines maximum", "🚀", {
    "prop-status": { option_id: "opt-review" },
    "prop-priority": { option_id: "opt-low" },
    "prop-due": { value: "2026-05-01" },
    "prop-assignee": { value: "Charlie" },
  }),
  makeRow("row-5", "Fix login redirect bug", null, {
    "prop-status": { option_id: "opt-todo" },
    "prop-priority": { option_id: "opt-high" },
  }),
  makeRow("row-6", "Write integration tests", "🧪", {
    "prop-status": { option_id: "opt-progress" },
    "prop-priority": { option_id: "opt-medium" },
    "prop-due": { value: "2026-05-05" },
    "prop-assignee": { value: "Alice" },
  }),
  makeRow("row-7", "Uncategorized task", null, {
    "prop-priority": { option_id: "opt-low" },
    "prop-due": { value: "2026-05-20" },
  }),
];

const defaultConfig: DatabaseViewConfig = {
  group_by: "prop-status",
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof BoardView> = {
  title: "Database/BoardView",
  component: BoardView,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-6xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    workspaceSlug: "my-workspace",
    onCardMove: fn(),
    onAddRow: fn(),
    onNavigate: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof BoardView>;

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

export const HideEmptyGroups: Story = {
  args: {
    rows: mockRows.filter((r) => {
      const optionId = r.values["prop-status"]?.value?.option_id;
      return optionId === "opt-todo" || optionId === "opt-progress";
    }),
    properties: mockProperties,
    viewConfig: {
      group_by: "prop-status",
      hide_empty_groups: true,
    },
  },
};

export const NoGroupByConfigured: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: {},
  },
};

export const WithVisibleProperties: Story = {
  args: {
    rows: mockRows,
    properties: mockProperties,
    viewConfig: {
      group_by: "prop-status",
      visible_properties: ["prop-priority", "prop-due"],
    },
  },
};

export const SingleColumn: Story = {
  args: {
    rows: mockRows.filter((r) => {
      const optionId = r.values["prop-status"]?.value?.option_id;
      return optionId === "opt-todo";
    }),
    properties: mockProperties,
    viewConfig: {
      group_by: "prop-status",
      hide_empty_groups: true,
    },
  },
};

export const ManyCards: Story = {
  args: {
    rows: [
      ...mockRows,
      ...Array.from({ length: 8 }, (_, i) =>
        makeRow(`row-extra-${i}`, `Extra task ${i + 1}`, null, {
          "prop-status": { option_id: statusOptions[i % statusOptions.length].id },
          "prop-priority": { option_id: priorityOptions[i % priorityOptions.length].id },
        }),
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
    onCardMove: undefined,
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
          "Tab to a card to focus it. Use ↑/↓ to move within a column, ←/→ to move between columns. Enter opens the card. Escape clears focus. Focused cards show a ring-2 ring-ring focus ring.",
      },
    },
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
