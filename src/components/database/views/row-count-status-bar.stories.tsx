import type { Meta, StoryObj } from "@storybook/react";
import { RowCountStatusBar } from "./row-count-status-bar";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof RowCountStatusBar> = {
  title: "Database/RowCountStatusBar",
  component: RowCountStatusBar,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof RowCountStatusBar>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state — no filters active, showing total row count */
export const Default: Story = {
  args: {
    filteredCount: 42,
    totalCount: 42,
  },
};

/** Filtered state — filters are active, showing filtered vs total */
export const Filtered: Story = {
  args: {
    filteredCount: 12,
    totalCount: 42,
  },
};

/** Empty state — zero rows in the database */
export const Empty: Story = {
  args: {
    filteredCount: 0,
    totalCount: 0,
  },
};

/** All filtered out — filters hide every row */
export const AllFilteredOut: Story = {
  args: {
    filteredCount: 0,
    totalCount: 25,
  },
};

/** Single row */
export const SingleRow: Story = {
  args: {
    filteredCount: 1,
    totalCount: 1,
  },
};
