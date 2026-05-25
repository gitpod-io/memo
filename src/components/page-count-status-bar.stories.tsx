import type { Meta, StoryObj } from "@storybook/react";
import { PageCountStatusBar } from "./page-count-status-bar";

const meta: Meta<typeof PageCountStatusBar> = {
  title: "Components/PageCountStatusBar",
  component: PageCountStatusBar,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PageCountStatusBar>;

/** Default state — no filter active, showing total page count */
export const Default: Story = {
  args: {
    filteredCount: 42,
    totalCount: 42,
  },
};

/** Filtered state — filter is active, showing filtered vs total */
export const Filtered: Story = {
  args: {
    filteredCount: 12,
    totalCount: 42,
  },
};

/** Empty state — zero pages in the workspace */
export const Empty: Story = {
  args: {
    filteredCount: 0,
    totalCount: 0,
  },
};

/** All filtered out — filter hides every page */
export const AllFilteredOut: Story = {
  args: {
    filteredCount: 0,
    totalCount: 25,
  },
};

/** Single page */
export const SinglePage: Story = {
  args: {
    filteredCount: 1,
    totalCount: 1,
  },
};
