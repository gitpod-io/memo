import type { Meta, StoryObj } from "@storybook/react";
import { CSVImportButton } from "./csv-import-button";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: {
      options: [
        { id: "opt-todo", name: "To Do", color: "gray" },
        { id: "opt-done", name: "Done", color: "green" },
      ],
    },
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-priority",
    database_id: "db-1",
    name: "Priority",
    type: "number",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CSVImportButton> = {
  title: "Database/CSVImportButton",
  component: CSVImportButton,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    pageId: "page-1",
    userId: "user-1",
    workspaceId: "ws-1",
    properties: mockProperties,
    onRowsImported: () => {},
    onPropertiesAdded: () => {},
  },
};

export { meta as default };

type Story = StoryObj<typeof CSVImportButton>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state — button ready to trigger file picker. */
export const Default: Story = {};

/** With no existing properties — all CSV columns will be new. */
export const NoProperties: Story = {
  args: {
    properties: [],
  },
};
