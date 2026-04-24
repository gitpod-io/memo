import type { Meta, StoryObj } from "@storybook/react";
import { TableSkeleton } from "./table-skeleton";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableSkeleton> = {
  title: "Database/TableSkeleton",
  component: TableSkeleton,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof TableSkeleton>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    rowHeight: "h-9",
    columnCount: 5,
  },
};

export const FewColumns: Story = {
  name: "Few columns",
  args: {
    rowHeight: "h-9",
    columnCount: 2,
  },
};

export const ManyColumns: Story = {
  name: "Many columns",
  args: {
    rowHeight: "h-9",
    columnCount: 10,
  },
};

export const CompactHeight: Story = {
  name: "Compact row height",
  args: {
    rowHeight: "h-7",
    columnCount: 5,
  },
};

export const TallHeight: Story = {
  name: "Tall row height",
  args: {
    rowHeight: "h-12",
    columnCount: 5,
  },
};
