import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { CSVImportDialog } from "./csv-import-dialog";
import type { DatabaseProperty } from "@/lib/types";
import type { ParsedCSV } from "@/lib/csv-import";

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

const matchedCSV: ParsedCSV = {
  headers: ["Title", "Status", "Priority", "Due Date"],
  rows: [
    ["Design homepage", "To Do", "1", "2026-05-01"],
    ["Build API", "Done", "2", "2026-04-15"],
    ["Write tests", "To Do", "3", "2026-05-10"],
    ["Deploy", "To Do", "4", "2026-06-01"],
    ["Review", "Done", "5", "2026-06-15"],
  ],
};

const unmatchedCSV: ParsedCSV = {
  headers: ["Title", "Status", "Priority", "Category", "Assignee"],
  rows: [
    ["Task A", "To Do", "1", "Frontend", "Alice"],
    ["Task B", "Done", "2", "Backend", "Bob"],
    ["Task C", "To Do", "3", "Design", "Carol"],
  ],
};

const largeCSV: ParsedCSV = {
  headers: ["Title", "Status", "Priority"],
  rows: Array.from({ length: 100 }, (_, i) => [
    `Task ${i + 1}`,
    i % 2 === 0 ? "To Do" : "Done",
    String(i + 1),
  ]),
};

const singleRowCSV: ParsedCSV = {
  headers: ["Title", "Status"],
  rows: [["Only task", "To Do"]],
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CSVImportDialog> = {
  title: "Database/CSVImportDialog",
  component: CSVImportDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    importing: false,
    properties: mockProperties,
    parsedCSV: matchedCSV,
  },
};

export { meta as default };

type Story = StoryObj<typeof CSVImportDialog>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** All CSV columns match existing database properties. */
export const AllColumnsMatched: Story = {};

/** Some CSV columns don't match — shows create-as-new checkboxes. */
export const UnmatchedColumns: Story = {
  args: {
    parsedCSV: unmatchedCSV,
  },
};

/** Large import — 100 rows, preview shows first 5. */
export const LargeImport: Story = {
  args: {
    parsedCSV: largeCSV,
  },
};

/** Single row import. */
export const SingleRow: Story = {
  args: {
    parsedCSV: singleRowCSV,
  },
};

/** Importing state — buttons disabled, shows progress text. */
export const Importing: Story = {
  args: {
    importing: true,
  },
};

/** No existing properties — all columns are new. */
export const NoExistingProperties: Story = {
  args: {
    properties: [],
    parsedCSV: matchedCSV,
  },
};
