import type { Meta, StoryObj } from "@storybook/react";
import { CellRenderer } from "./table-cell-renderer";
import type { DatabaseProperty, RowValue } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ts = "2026-04-01T00:00:00Z";

function makeProp(
  overrides: Partial<DatabaseProperty> & { type: DatabaseProperty["type"] },
): DatabaseProperty {
  const { type, ...rest } = overrides;
  return {
    id: `prop-${type}`,
    database_id: "db-1",
    name: overrides.name ?? type,
    config: {},
    position: 1,
    created_at: ts,
    updated_at: ts,
    ...rest,
    type,
  };
}

function makeValue(
  propertyId: string,
  value: Record<string, unknown>,
): RowValue {
  return {
    id: `rv-${propertyId}`,
    row_id: "row-1",
    property_id: propertyId,
    value,
    created_at: ts,
    updated_at: ts,
  };
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const textProp = makeProp({ type: "text", name: "Name" });
const numberProp = makeProp({ type: "number", name: "Score" });
const selectProp = makeProp({
  type: "select",
  name: "Status",
  config: {
    options: [
      { id: "opt-todo", name: "To Do", color: "gray" },
      { id: "opt-doing", name: "In Progress", color: "blue" },
      { id: "opt-done", name: "Done", color: "green" },
    ],
  },
});
const multiSelectProp = makeProp({
  type: "multi_select",
  name: "Tags",
  config: {
    options: [
      { id: "tag-a", name: "Frontend", color: "blue" },
      { id: "tag-b", name: "Backend", color: "green" },
      { id: "tag-c", name: "Urgent", color: "red" },
    ],
  },
});
const statusProp = makeProp({
  type: "status",
  name: "Stage",
  config: {
    options: [
      { id: "s-ns", name: "Not Started", color: "gray" },
      { id: "s-ip", name: "In Progress", color: "blue" },
      { id: "s-done", name: "Done", color: "green" },
    ],
  },
});
const dateProp = makeProp({ type: "date", name: "Due Date" });
const urlProp = makeProp({ type: "url", name: "Link" });
const emailProp = makeProp({ type: "email", name: "Email" });
const phoneProp = makeProp({ type: "phone", name: "Phone" });
const formulaProp = makeProp({ type: "formula", name: "Total" });
const createdTimeProp = makeProp({ type: "created_time", name: "Created" });
const updatedTimeProp = makeProp({ type: "updated_time", name: "Updated" });

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CellRenderer> = {
  title: "Database/CellRenderer",
  component: CellRenderer,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="flex w-48 items-center bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof CellRenderer>;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const Text: Story = {
  args: {
    property: textProp,
    propertyType: "text",
    value: makeValue(textProp.id, { text: "Design system tokens" }),
    displayValue: "Design system tokens",
  },
};

export const TextEmpty: Story = {
  name: "Text (empty)",
  args: {
    property: textProp,
    propertyType: "text",
    value: undefined,
    displayValue: "",
  },
};

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

export const Number: Story = {
  args: {
    property: numberProp,
    propertyType: "number",
    value: makeValue(numberProp.id, { number: 42 }),
    displayValue: "42",
  },
};

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export const Select: Story = {
  args: {
    property: selectProp,
    propertyType: "select",
    value: makeValue(selectProp.id, { option_id: "opt-doing" }),
    displayValue: "",
  },
};

export const SelectNoMatch: Story = {
  name: "Select (no matching option)",
  args: {
    property: selectProp,
    propertyType: "select",
    value: makeValue(selectProp.id, { option_id: "nonexistent" }),
    displayValue: "",
  },
};

// ---------------------------------------------------------------------------
// Multi-select
// ---------------------------------------------------------------------------

export const MultiSelect: Story = {
  args: {
    property: multiSelectProp,
    propertyType: "multi_select",
    value: makeValue(multiSelectProp.id, {
      option_ids: ["tag-a", "tag-b", "tag-c"],
    }),
    displayValue: "",
  },
};

export const MultiSelectSingle: Story = {
  name: "Multi-select (single tag)",
  args: {
    property: multiSelectProp,
    propertyType: "multi_select",
    value: makeValue(multiSelectProp.id, { option_ids: ["tag-a"] }),
    displayValue: "",
  },
};

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const Status: Story = {
  args: {
    property: statusProp,
    propertyType: "status",
    value: makeValue(statusProp.id, { option_id: "s-ip" }),
    displayValue: "",
  },
};

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

export const Date: Story = {
  args: {
    property: dateProp,
    propertyType: "date",
    value: makeValue(dateProp.id, { date: "2026-04-30" }),
    displayValue: "2026-04-30",
  },
};

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export const Url: Story = {
  args: {
    property: urlProp,
    propertyType: "url",
    value: makeValue(urlProp.id, { url: "https://example.com/design" }),
    displayValue: "https://example.com/design",
  },
};

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const Email: Story = {
  args: {
    property: emailProp,
    propertyType: "email",
    value: makeValue(emailProp.id, { email: "user@example.com" }),
    displayValue: "user@example.com",
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export const Phone: Story = {
  args: {
    property: phoneProp,
    propertyType: "phone",
    value: makeValue(phoneProp.id, { phone: "+1 555-0123" }),
    displayValue: "+1 555-0123",
  },
};

// ---------------------------------------------------------------------------
// Formula
// ---------------------------------------------------------------------------

export const Formula: Story = {
  args: {
    property: formulaProp,
    propertyType: "formula",
    value: makeValue(formulaProp.id, { value: "128" }),
    displayValue: "128",
  },
};

// ---------------------------------------------------------------------------
// Created time
// ---------------------------------------------------------------------------

export const CreatedTime: Story = {
  args: {
    property: createdTimeProp,
    propertyType: "created_time",
    value: makeValue(createdTimeProp.id, { value: "2026-04-01" }),
    displayValue: "2026-04-01",
  },
};

// ---------------------------------------------------------------------------
// Updated time
// ---------------------------------------------------------------------------

export const UpdatedTime: Story = {
  args: {
    property: updatedTimeProp,
    propertyType: "updated_time",
    value: makeValue(updatedTimeProp.id, { value: "2026-04-15" }),
    displayValue: "2026-04-15",
  },
};
