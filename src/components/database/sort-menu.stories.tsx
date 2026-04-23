import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { SortMenu } from "./sort-menu";
import type { DatabaseProperty } from "@/lib/types";
import type { SortRule } from "@/lib/database-filters";

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
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SortMenu> = {
  title: "Database/SortMenu",
  component: SortMenu,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="flex max-w-3xl bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    properties: mockProperties,
    onSortsChange: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof SortMenu>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** No active sorts. */
export const NoSorts: Story = {
  args: {
    sorts: [],
  },
};

/** Single sort rule. */
export const SingleSort: Story = {
  args: {
    sorts: [{ property_id: "prop-name", direction: "asc" }],
  },
};

/** Multiple sort rules. */
export const MultipleSorts: Story = {
  args: {
    sorts: [
      { property_id: "prop-status", direction: "asc" },
      { property_id: "prop-score", direction: "desc" },
    ],
  },
};

/** Interactive story with state management. */
export const Interactive: Story = {
  render: function InteractiveSortMenu() {
    const [sorts, setSorts] = useState<SortRule[]>([
      { property_id: "prop-name", direction: "asc" },
    ]);

    return (
      <div className="space-y-4">
        <div className="flex">
          <SortMenu
            properties={mockProperties}
            sorts={sorts}
            onSortsChange={setSorts}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Active sorts: {sorts.length === 0 ? "none" : JSON.stringify(sorts, null, 2)}
        </div>
      </div>
    );
  },
};
