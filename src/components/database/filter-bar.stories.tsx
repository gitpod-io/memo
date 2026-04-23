import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { FilterBar } from "./filter-bar";
import type { DatabaseProperty } from "@/lib/types";
import type { FilterRule } from "@/lib/database-filters";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-name",
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
    config: {
      options: [
        { id: "opt-todo", name: "To Do", color: "gray" },
        { id: "opt-progress", name: "In Progress", color: "blue" },
        { id: "opt-done", name: "Done", color: "green" },
      ],
    },
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-score",
    database_id: "db-1",
    name: "Score",
    type: "number",
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
    id: "prop-done",
    database_id: "db-1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: 4,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-url",
    database_id: "db-1",
    name: "Link",
    type: "url",
    config: {},
    position: 5,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-tags",
    database_id: "db-1",
    name: "Tags",
    type: "multi_select",
    config: {
      options: [
        { id: "tag-frontend", name: "Frontend", color: "blue" },
        { id: "tag-backend", name: "Backend", color: "green" },
        { id: "tag-design", name: "Design", color: "purple" },
      ],
    },
    position: 6,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof FilterBar> = {
  title: "Database/FilterBar",
  component: FilterBar,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    properties: mockProperties,
    onFiltersChange: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof FilterBar>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** No active filters — bar is hidden until a filter is added. */
export const Empty: Story = {
  args: {
    filters: [],
  },
};

/** Single active text filter. */
export const SingleFilter: Story = {
  args: {
    filters: [
      { property_id: "prop-name", operator: "contains", value: "design" },
    ],
  },
};

/** Multiple active filters showing AND logic. */
export const MultipleFilters: Story = {
  args: {
    filters: [
      { property_id: "prop-name", operator: "contains", value: "design" },
      { property_id: "prop-score", operator: "gte", value: 5 },
      { property_id: "prop-done", operator: "is_checked", value: null },
    ],
  },
};

/** Filters with is_empty / is_not_empty operators (no value shown). */
export const EmptyOperators: Story = {
  args: {
    filters: [
      { property_id: "prop-due", operator: "is_not_empty", value: null },
      { property_id: "prop-url", operator: "is_empty", value: null },
    ],
  },
};

/** Select filter showing resolved option name from config. */
export const SelectFilter: Story = {
  args: {
    filters: [
      { property_id: "prop-status", operator: "equals", value: "opt-done" },
    ],
  },
};

/** Multi-select filter with option badge. */
export const MultiSelectFilter: Story = {
  args: {
    filters: [
      { property_id: "prop-tags", operator: "contains", value: "tag-frontend" },
    ],
  },
};

/** Date filter. */
export const DateFilter: Story = {
  args: {
    filters: [
      { property_id: "prop-due", operator: "before", value: "2026-06-01" },
    ],
  },
};

/** Checkbox filter with is_checked / is_not_checked operators. */
export const CheckboxFilter: Story = {
  args: {
    filters: [
      { property_id: "prop-done", operator: "is_checked", value: null },
    ],
  },
};

/** Many filters to test wrapping behavior. */
export const ManyFilters: Story = {
  args: {
    filters: [
      { property_id: "prop-name", operator: "contains", value: "project" },
      { property_id: "prop-status", operator: "equals", value: "opt-progress" },
      { property_id: "prop-score", operator: "gt", value: 10 },
      { property_id: "prop-due", operator: "before", value: "2026-06-01" },
      { property_id: "prop-done", operator: "is_not_checked", value: null },
      { property_id: "prop-url", operator: "is_not_empty", value: null },
    ],
  },
};

/** Interactive story with state management. */
export const Interactive: Story = {
  render: function InteractiveFilterBar() {
    const [filters, setFilters] = useState<FilterRule[]>([
      { property_id: "prop-name", operator: "contains", value: "alpha" },
    ]);

    return (
      <div className="space-y-4">
        <FilterBar
          properties={mockProperties}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div className="text-xs text-muted-foreground">
          Active filters: {filters.length === 0 ? "none" : JSON.stringify(filters, null, 2)}
        </div>
      </div>
    );
  },
};
