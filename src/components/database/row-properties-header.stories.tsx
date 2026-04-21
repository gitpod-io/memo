import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty, RowValue } from "@/lib/types";
import { RowPropertiesHeader } from "./row-properties-header";

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function mockProperty(
  overrides: Partial<DatabaseProperty> & { id: string; name: string; type: DatabaseProperty["type"] },
): DatabaseProperty {
  return {
    database_id: "db-1",
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockRowValue(
  propertyId: string,
  value: Record<string, unknown>,
): RowValue {
  return {
    id: `rv-${propertyId}`,
    row_id: "row-1",
    property_id: propertyId,
    value,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const threeProperties: DatabaseProperty[] = [
  mockProperty({ id: "p1", name: "Status", type: "select", position: 0 }),
  mockProperty({ id: "p2", name: "Priority", type: "select", position: 1 }),
  mockProperty({ id: "p3", name: "Assignee", type: "text", position: 2 }),
];

const threeValues: Record<string, RowValue> = {
  p1: mockRowValue("p1", {
    value: "In Progress",
    items: [{ value: "In Progress", color: "blue" }],
  }),
  p2: mockRowValue("p2", {
    value: "High",
    items: [{ value: "High", color: "red" }],
  }),
  p3: mockRowValue("p3", { text: "Alice" }),
};

const sevenProperties: DatabaseProperty[] = [
  mockProperty({ id: "p1", name: "Status", type: "select", position: 0 }),
  mockProperty({ id: "p2", name: "Priority", type: "select", position: 1 }),
  mockProperty({ id: "p3", name: "Assignee", type: "text", position: 2 }),
  mockProperty({ id: "p4", name: "Due Date", type: "date", position: 3 }),
  mockProperty({ id: "p5", name: "URL", type: "url", position: 4 }),
  mockProperty({ id: "p6", name: "Created", type: "created_time", position: 5 }),
  mockProperty({ id: "p7", name: "Updated", type: "updated_time", position: 6 }),
];

const sevenValues: Record<string, RowValue> = {
  p1: mockRowValue("p1", {
    value: "Done",
    items: [{ value: "Done", color: "green" }],
  }),
  p2: mockRowValue("p2", {
    value: "Medium",
    items: [{ value: "Medium", color: "yellow" }],
  }),
  p3: mockRowValue("p3", { text: "Bob" }),
  p4: mockRowValue("p4", { value: "2026-03-15" }),
  p5: mockRowValue("p5", { value: "https://example.com" }),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof RowPropertiesHeader> = {
  title: "Database/RowPropertiesHeader",
  component: RowPropertiesHeader,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    pageId: "row-1",
    pageCreatedAt: "2026-01-15T10:30:00Z",
    pageUpdatedAt: "2026-04-20T14:00:00Z",
    pageCreatedBy: "user-123",
  },
};

export { meta as default };

type Story = StoryObj<typeof RowPropertiesHeader>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const FewProperties: Story = {
  args: {
    properties: threeProperties,
    values: threeValues,
  },
};

export const ManyProperties: Story = {
  name: "Many Properties (collapsed)",
  args: {
    properties: sevenProperties,
    values: sevenValues,
  },
};

export const EmptyValues: Story = {
  args: {
    properties: threeProperties,
    values: {},
  },
};

export const ComputedOnly: Story = {
  args: {
    properties: [
      mockProperty({ id: "p1", name: "Created", type: "created_time", position: 0 }),
      mockProperty({ id: "p2", name: "Updated", type: "updated_time", position: 1 }),
      mockProperty({ id: "p3", name: "Created By", type: "created_by", position: 2 }),
    ],
    values: {},
  },
};

export const MixedTypes: Story = {
  args: {
    properties: [
      mockProperty({ id: "p1", name: "Title", type: "text", position: 0 }),
      mockProperty({ id: "p2", name: "Count", type: "number", position: 1 }),
      mockProperty({ id: "p3", name: "Done", type: "checkbox", position: 2 }),
      mockProperty({ id: "p4", name: "Email", type: "email", position: 3 }),
      mockProperty({ id: "p5", name: "Phone", type: "phone", position: 4 }),
    ],
    values: {
      p1: mockRowValue("p1", { text: "Feature request" }),
      p2: mockRowValue("p2", { value: 42 }),
      p3: mockRowValue("p3", { value: true }),
      p4: mockRowValue("p4", { value: "alice@example.com" }),
      p5: mockRowValue("p5", { value: "+1 555-0123" }),
    },
  },
};

export const ExactlyFiveProperties: Story = {
  name: "Exactly 5 Properties (no collapse)",
  args: {
    properties: [
      mockProperty({ id: "p1", name: "Status", type: "select", position: 0 }),
      mockProperty({ id: "p2", name: "Priority", type: "text", position: 1 }),
      mockProperty({ id: "p3", name: "Assignee", type: "text", position: 2 }),
      mockProperty({ id: "p4", name: "Due Date", type: "date", position: 3 }),
      mockProperty({ id: "p5", name: "Notes", type: "text", position: 4 }),
    ],
    values: {
      p1: mockRowValue("p1", {
        value: "Open",
        items: [{ value: "Open", color: "blue" }],
      }),
      p2: mockRowValue("p2", { text: "P1" }),
      p3: mockRowValue("p3", { text: "Charlie" }),
      p4: mockRowValue("p4", { value: "2026-06-01" }),
      p5: mockRowValue("p5", { text: "Needs review" }),
    },
  },
};

export const SixProperties: Story = {
  name: "6 Properties (shows collapse toggle)",
  args: {
    properties: [
      mockProperty({ id: "p1", name: "Status", type: "select", position: 0 }),
      mockProperty({ id: "p2", name: "Priority", type: "text", position: 1 }),
      mockProperty({ id: "p3", name: "Assignee", type: "text", position: 2 }),
      mockProperty({ id: "p4", name: "Due Date", type: "date", position: 3 }),
      mockProperty({ id: "p5", name: "Notes", type: "text", position: 4 }),
      mockProperty({ id: "p6", name: "Created", type: "created_time", position: 5 }),
    ],
    values: {
      p1: mockRowValue("p1", {
        value: "Open",
        items: [{ value: "Open", color: "blue" }],
      }),
      p2: mockRowValue("p2", { text: "P2" }),
      p3: mockRowValue("p3", { text: "Dave" }),
      p4: mockRowValue("p4", { value: "2026-07-01" }),
      p5: mockRowValue("p5", { text: "WIP" }),
    },
  },
};

export const NoProperties: Story = {
  args: {
    properties: [],
    values: {},
  },
};
