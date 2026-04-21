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
    config: {},
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
      { property_id: "prop-done", operator: "equals", value: true },
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

/** Many filters to test wrapping behavior. */
export const ManyFilters: Story = {
  args: {
    filters: [
      { property_id: "prop-name", operator: "contains", value: "project" },
      { property_id: "prop-status", operator: "equals", value: "Active" },
      { property_id: "prop-score", operator: "gt", value: 10 },
      { property_id: "prop-due", operator: "before", value: "2026-06-01" },
      { property_id: "prop-done", operator: "equals", value: false },
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
