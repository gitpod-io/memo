import type { Meta, StoryObj } from "@storybook/react";
import { CSVExportButton } from "./csv-export-button";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

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
  {
    id: "prop-due",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

function makeRow(
  id: string,
  title: string,
  values: Record<string, Record<string, unknown>>,
): DatabaseRow {
  const rowValues: Record<string, DatabaseRow["values"][string]> = {};
  for (const [propId, val] of Object.entries(values)) {
    rowValues[propId] = {
      id: `rv-${id}-${propId}`,
      row_id: id,
      property_id: propId,
      value: val,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    };
  }
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: null,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      created_by: "user-1",
    },
    values: rowValues,
  };
}

const mockRows: DatabaseRow[] = [
  makeRow("row-1", "Design homepage", {
    "prop-status": { option_id: "opt-todo" },
    "prop-priority": { number: 1 },
    "prop-due": { date: "2026-05-01" },
  }),
  makeRow("row-2", "Build API", {
    "prop-status": { option_id: "opt-done" },
    "prop-priority": { number: 2 },
    "prop-due": { date: "2026-04-15" },
  }),
  makeRow("row-3", "Write tests", {
    "prop-status": { option_id: "opt-todo" },
    "prop-priority": { number: 3 },
    "prop-due": { date: "2026-05-10" },
  }),
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CSVExportButton> = {
  title: "Database/CSVExportButton",
  component: CSVExportButton,
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
    rows: mockRows,
    properties: mockProperties,
    databaseTitle: "Project Tasks",
    userId: "user-1",
    workspaceId: "ws-1",
    pageId: "page-1",
  },
};

export { meta as default };

type Story = StoryObj<typeof CSVExportButton>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state with rows available for export. */
export const Default: Story = {};

/** Empty database — button still renders but exports an empty CSV. */
export const EmptyDatabase: Story = {
  args: {
    rows: [],
  },
};

/** Single row. */
export const SingleRow: Story = {
  args: {
    rows: [mockRows[0]],
  },
};

/** Many rows — tooltip shows count. */
export const ManyRows: Story = {
  args: {
    rows: Array.from({ length: 50 }, (_, i) =>
      makeRow(`row-${i}`, `Task ${i + 1}`, {
        "prop-status": { option_id: i % 2 === 0 ? "opt-todo" : "opt-done" },
        "prop-priority": { number: i + 1 },
        "prop-due": { date: "2026-06-01" },
      }),
    ),
  },
};
