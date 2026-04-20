import type { Meta, StoryObj } from "@storybook/react";
import { RelativeTime } from "./relative-time";

const meta: Meta<typeof RelativeTime> = {
  title: "Components/RelativeTime",
  component: RelativeTime,
};

export { meta as default };

type Story = StoryObj<typeof RelativeTime>;

export const JustNow: Story = {
  args: {
    dateStr: new Date().toISOString(),
  },
};

export const MinutesAgo: Story = {
  args: {
    dateStr: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
};

export const HoursAgo: Story = {
  args: {
    dateStr: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
};

export const DaysAgo: Story = {
  args: {
    dateStr: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
};

export const WeeksAgo: Story = {
  args: {
    dateStr: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    className: "text-xs text-muted-foreground",
  },
};
