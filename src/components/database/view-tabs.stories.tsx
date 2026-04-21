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

const singleView: DatabaseView[] = [
  {
    id: "view-only",
    database_id: "db-1",
    name: "Default view",
    type: "table",
    config: {},
    position: 0,
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
    onRenameView: fn(),
    onDeleteView: fn(),
    onDuplicateView: fn(),
    onReorderViews: fn(),
  },
};

export { meta as default };
type Story = StoryObj<typeof ViewTabs>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state with multiple views and all management handlers. */
export const Default: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
  },
};

/** Second tab is active. */
export const SecondTabActive: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-2",
  },
};

/** All five view types displayed. */
export const AllViewTypes: Story = {
  args: {
    views: allViewTypes,
    activeViewId: "view-table",
  },
};

/** Single view — delete is disabled in context menu, last-view protection. */
export const SingleView: Story = {
  args: {
    views: singleView,
    activeViewId: "view-only",
  },
};

/** Without add button — onAddView not provided. */
export const WithoutAddButton: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
    onAddView: undefined,
  },
};

/** Read-only mode — no management handlers, just view switching. */
export const ReadOnly: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
    onAddView: undefined,
    onRenameView: undefined,
    onDeleteView: undefined,
    onDuplicateView: undefined,
    onReorderViews: undefined,
  },
};

/** Without reorder — drag handles hidden when onReorderViews is not provided. */
export const WithoutReorder: Story = {
  args: {
    views: mockViews,
    activeViewId: "view-1",
    onReorderViews: undefined,
  },
};

/** Many views — tests horizontal overflow scrolling. */
export const ManyViews: Story = {
  args: {
    views: [
      ...allViewTypes,
      {
        id: "view-extra-1",
        database_id: "db-1",
        name: "Sprint backlog",
        type: "table",
        config: {},
        position: 5,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "view-extra-2",
        database_id: "db-1",
        name: "Roadmap calendar",
        type: "calendar",
        config: {},
        position: 6,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "view-extra-3",
        database_id: "db-1",
        name: "Team board",
        type: "board",
        config: {},
        position: 7,
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
    ],
    activeViewId: "view-table",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};
