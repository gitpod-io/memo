import type { Meta, StoryObj } from "@storybook/react";
import { PageBreadcrumb } from "./page-breadcrumb";

const meta: Meta<typeof PageBreadcrumb> = {
  title: "Components/PageBreadcrumb",
  component: PageBreadcrumb,
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof PageBreadcrumb>;

export const RootPage: Story = {
  args: {
    items: [
      { id: "ws", title: "My Workspace", href: "/my-workspace" },
      { id: "p1", title: "Getting Started", href: "/my-workspace/page-1" },
    ],
  },
};

export const NestedPage: Story = {
  args: {
    items: [
      { id: "ws", title: "My Workspace", href: "/my-workspace" },
      { id: "p1", title: "Engineering", href: "/my-workspace/page-1" },
      { id: "p2", title: "Backend", href: "/my-workspace/page-2" },
      { id: "p3", title: "API Design", href: "/my-workspace/page-3" },
    ],
  },
};

export const DeeplyNested: Story = {
  args: {
    items: [
      { id: "ws", title: "Team Workspace", href: "/team" },
      { id: "p1", title: "Projects", href: "/team/p1" },
      { id: "p2", title: "Q2 Planning", href: "/team/p2" },
      { id: "p3", title: "Backend Services", href: "/team/p3" },
      { id: "p4", title: "Auth Refactor", href: "/team/p4" },
      { id: "p5", title: "Implementation Notes", href: "/team/p5" },
    ],
  },
};

export const LongTitles: Story = {
  args: {
    items: [
      {
        id: "ws",
        title: "My Very Long Workspace Name That Goes On Forever",
        href: "/workspace",
      },
      {
        id: "p1",
        title: "This Is An Extremely Long Page Title That Should Be Truncated",
        href: "/workspace/p1",
      },
      {
        id: "p2",
        title: "Another Ridiculously Long Title For Testing Purposes Only",
        href: "/workspace/p2",
      },
    ],
  },
};

export const UntitledPages: Story = {
  args: {
    items: [
      { id: "ws", title: "My Workspace", href: "/my-workspace" },
      { id: "p1", title: "", href: "/my-workspace/p1" },
      { id: "p2", title: "Current Page", href: "/my-workspace/p2" },
    ],
  },
};

export const SingleSegment: Story = {
  args: {
    items: [
      { id: "ws", title: "My Workspace", href: "/my-workspace" },
    ],
  },
};

export const DatabaseRowPage: Story = {
  args: {
    items: [
      { id: "ws", title: "My Workspace", href: "/my-workspace" },
      { id: "db1", title: "Task Tracker", href: "/my-workspace/db1", isDatabase: true },
      { id: "row1", title: "Fix login bug", href: "/my-workspace/row1" },
    ],
  },
};

export const NestedDatabaseRow: Story = {
  args: {
    items: [
      { id: "ws", title: "Team Workspace", href: "/team" },
      { id: "p1", title: "Projects", href: "/team/p1" },
      { id: "db1", title: "Sprint Board", href: "/team/db1", isDatabase: true },
      { id: "row1", title: "Implement auth flow", href: "/team/row1" },
    ],
  },
};
