import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TableCell } from "./table-cell";
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

const defaultHandlers = {
  onStartEditing: fn(),
  onKeyDown: fn(),
  onBlur: fn(),
  onFocus: fn(),
};

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
const dateProp = makeProp({ type: "date", name: "Due Date" });
const checkboxProp = makeProp({ type: "checkbox", name: "Done" });
const urlProp = makeProp({ type: "url", name: "Link" });
const emailProp = makeProp({ type: "email", name: "Email" });
const phoneProp = makeProp({ type: "phone", name: "Phone" });
const formulaProp = makeProp({ type: "formula", name: "Total" });
const personProp = makeProp({ type: "person", name: "Assignee" });

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableCell> = {
  title: "Database/TableCell",
  component: TableCell,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-64 bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    rowId: "row-1",
    rowIndex: 0,
    colIndex: 0,
    isEditing: false,
    isFocused: false,
    rowHeightClass: "h-9",
    ...defaultHandlers,
  },
};

export { meta as default };

type Story = StoryObj<typeof TableCell>;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const Text: Story = {
  args: {
    propertyId: textProp.id,
    property: textProp,
    propertyType: "text",
    value: makeValue(textProp.id, { text: "Design system tokens" }),
  },
};

export const TextEditing: Story = {
  name: "Text (editing)",
  args: {
    ...Text.args,
    isEditing: true,
  },
};

export const TextEmpty: Story = {
  name: "Text (empty)",
  args: {
    propertyId: textProp.id,
    property: textProp,
    propertyType: "text",
    value: undefined,
  },
};

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

export const Number: Story = {
  args: {
    propertyId: numberProp.id,
    property: numberProp,
    propertyType: "number",
    value: makeValue(numberProp.id, { number: 42 }),
  },
};

export const NumberEditing: Story = {
  name: "Number (editing)",
  args: {
    ...Number.args,
    isEditing: true,
  },
};

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export const Select: Story = {
  args: {
    propertyId: selectProp.id,
    property: selectProp,
    propertyType: "select",
    value: makeValue(selectProp.id, { option_id: "opt-doing" }),
  },
};

export const SelectEditing: Story = {
  name: "Select (editing)",
  args: {
    ...Select.args,
    isEditing: true,
  },
};

// ---------------------------------------------------------------------------
// Multi-select
// ---------------------------------------------------------------------------

export const MultiSelect: Story = {
  args: {
    propertyId: multiSelectProp.id,
    property: multiSelectProp,
    propertyType: "multi_select",
    value: makeValue(multiSelectProp.id, {
      option_ids: ["tag-a", "tag-c"],
    }),
  },
};

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

export const Date: Story = {
  args: {
    propertyId: dateProp.id,
    property: dateProp,
    propertyType: "date",
    value: makeValue(dateProp.id, { date: "2026-04-30" }),
  },
};

export const DateEditing: Story = {
  name: "Date (editing)",
  args: {
    ...Date.args,
    isEditing: true,
  },
};

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

export const CheckboxChecked: Story = {
  name: "Checkbox (checked)",
  args: {
    propertyId: checkboxProp.id,
    property: checkboxProp,
    propertyType: "checkbox",
    value: makeValue(checkboxProp.id, { checked: true }),
  },
};

export const CheckboxUnchecked: Story = {
  name: "Checkbox (unchecked)",
  args: {
    propertyId: checkboxProp.id,
    property: checkboxProp,
    propertyType: "checkbox",
    value: makeValue(checkboxProp.id, { checked: false }),
  },
};

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export const Url: Story = {
  args: {
    propertyId: urlProp.id,
    property: urlProp,
    propertyType: "url",
    value: makeValue(urlProp.id, { url: "https://example.com" }),
  },
};

export const UrlEditing: Story = {
  name: "URL (editing)",
  args: {
    ...Url.args,
    isEditing: true,
  },
};

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const Email: Story = {
  args: {
    propertyId: emailProp.id,
    property: emailProp,
    propertyType: "email",
    value: makeValue(emailProp.id, { email: "user@example.com" }),
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export const Phone: Story = {
  args: {
    propertyId: phoneProp.id,
    property: phoneProp,
    propertyType: "phone",
    value: makeValue(phoneProp.id, { phone: "+1 555-0123" }),
  },
};

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export const Person: Story = {
  args: {
    propertyId: personProp.id,
    property: personProp,
    propertyType: "person",
    value: makeValue(personProp.id, { user_id: "user-1" }),
  },
};

// ---------------------------------------------------------------------------
// Formula (read-only)
// ---------------------------------------------------------------------------

export const Formula: Story = {
  args: {
    propertyId: formulaProp.id,
    property: formulaProp,
    propertyType: "formula",
    value: undefined,
    computedValue: { _display: "128", _error: null },
  },
};

export const FormulaError: Story = {
  name: "Formula (error)",
  args: {
    propertyId: formulaProp.id,
    property: formulaProp,
    propertyType: "formula",
    value: undefined,
    computedValue: { _display: "", _error: "Division by zero" },
  },
};

// ---------------------------------------------------------------------------
// Focused state
// ---------------------------------------------------------------------------

export const Focused: Story = {
  name: "Focused cell",
  args: {
    ...Text.args,
    isFocused: true,
  },
};

// ---------------------------------------------------------------------------
// Read-only (created_time)
// ---------------------------------------------------------------------------

export const ReadOnlyCreatedTime: Story = {
  name: "Read-only (created_time)",
  args: {
    propertyId: "prop-created",
    property: makeProp({
      id: "prop-created",
      type: "created_time",
      name: "Created",
    }),
    propertyType: "created_time",
    value: undefined,
    computedValue: { created_at: "2026-04-01T00:00:00Z" },
  },
};
