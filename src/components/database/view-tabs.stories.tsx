import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ViewTabs } from "./view-tabs";
import type { DatabaseView } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockViews: DatabaseView[] = [
  {
    id: "view-1",
    database_id: "db-1",
    name: "Default view",
    type: "table",
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-2",
    database_id: "db-1",
    name: "Board",
    type: "board",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-3",
    database_id: "db-1",
    name: "Tasks list",
    type: "list",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

const allViewTypes: DatabaseView[] = [
  {
    id: "view-table",
    database_id: "db-1",
    name: "Table",
    type: "table",
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-board",
    database_id: "db-1",
    name: "Board",
    type: "board",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-list",
    database_id: "db-1",
    name: "List",
    type: "list",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-calendar",
    database_id: "db-1",
    name: "Calendar",
    type: "calendar",
    config: {},
    position: 3,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-gallery",
    database_id: "db-1",
    name: "Gallery",
    type: "gallery",
    config: {},
    position: 4,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ViewTabs> = {
  title: "Database/ViewTabs",
  component: ViewTabs,
  parameters: {
    layout: "padded",
  },
  args: {
    onViewChange: fn(),
    onAddView: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ViewTabs>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
  },
};

export const SecondTabActive: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-2",
  },
};

export const AllViewTypes: Story = {
  args: {
    views: allViewTypes,
    activeViewId: "view-table",
  },
};

export const SingleView: Story = {
  args: {
    views: [mockViews[0]],
    activeViewId: "view-1",
  },
};

export const WithoutAddButton: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
    onAddView: undefined,
  },
};
