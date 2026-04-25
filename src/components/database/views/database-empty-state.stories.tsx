import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DatabaseEmptyState } from "./database-empty-state";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof DatabaseEmptyState> = {
  title: "Database/DatabaseEmptyState",
  component: DatabaseEmptyState,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof DatabaseEmptyState>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default empty state when the database has no rows and no filters are active */
export const NoRows: Story = {
  args: {
    hasActiveFilters: false,
  },
};

/** Filter-aware empty state when filters are active but no rows match */
export const FilteredEmpty: Story = {
  args: {
    hasActiveFilters: true,
    onClearFilters: fn(),
  },
};

/** Filter-aware empty state without a clear filters callback (read-only) */
export const FilteredEmptyReadOnly: Story = {
  args: {
    hasActiveFilters: true,
    onClearFilters: undefined,
  },
};
