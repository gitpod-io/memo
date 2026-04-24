import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import {
  FilterValueEditor,
  PropertyPicker,
  OperatorPicker,
} from "./filter-value-editor";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const textProperty: DatabaseProperty = {
  id: "prop-name",
  database_id: "db-1",
  name: "Name",
  type: "text",
  config: {},
  position: 0,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const numberProperty: DatabaseProperty = {
  id: "prop-score",
  database_id: "db-1",
  name: "Score",
  type: "number",
  config: {},
  position: 1,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const selectProperty: DatabaseProperty = {
  id: "prop-status",
  database_id: "db-1",
  name: "Status",
  type: "select",
  config: {
    options: [
      { id: "opt-todo", name: "To Do", color: "gray" },
      { id: "opt-progress", name: "In Progress", color: "blue" },
      { id: "opt-done", name: "Done", color: "green" },
    ],
  },
  position: 2,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const multiSelectProperty: DatabaseProperty = {
  id: "prop-tags",
  database_id: "db-1",
  name: "Tags",
  type: "multi_select",
  config: {
    options: [
      { id: "tag-frontend", name: "Frontend", color: "blue" },
      { id: "tag-backend", name: "Backend", color: "green" },
      { id: "tag-design", name: "Design", color: "purple" },
    ],
  },
  position: 3,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const dateProperty: DatabaseProperty = {
  id: "prop-due",
  database_id: "db-1",
  name: "Due Date",
  type: "date",
  config: {},
  position: 4,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const statusProperty: DatabaseProperty = {
  id: "prop-state",
  database_id: "db-1",
  name: "State",
  type: "status",
  config: {
    options: [
      { id: "st-open", name: "Open", color: "blue" },
      { id: "st-closed", name: "Closed", color: "green" },
    ],
  },
  position: 5,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const urlProperty: DatabaseProperty = {
  id: "prop-url",
  database_id: "db-1",
  name: "Link",
  type: "url",
  config: {},
  position: 6,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

const allProperties: DatabaseProperty[] = [
  textProperty,
  numberProperty,
  selectProperty,
  multiSelectProperty,
  dateProperty,
  statusProperty,
  urlProperty,
];

// ---------------------------------------------------------------------------
// Decorator — positions dropdowns visibly
// ---------------------------------------------------------------------------

const dropdownDecorator = (Story: React.ComponentType) => (
  <div className="relative max-w-xs bg-background p-4 pt-8">
    <Story />
  </div>
);

// ---------------------------------------------------------------------------
// FilterValueEditor Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof FilterValueEditor> = {
  title: "Database/FilterValueEditor",
  component: FilterValueEditor,
  parameters: {
    layout: "padded",
  },
  decorators: [dropdownDecorator],
  args: {
    valueInput: "",
    onValueInputChange: fn(),
    onSubmit: fn(),
    onSelectValue: fn(),
    onClose: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof FilterValueEditor>;

// ---------------------------------------------------------------------------
// Stories — FilterValueEditor variants
// ---------------------------------------------------------------------------

/** Text property shows a text input with "Enter value…" placeholder. */
export const TextInput: Story = {
  args: {
    property: textProperty,
  },
};

/** Number property shows a number input with "Enter number…" placeholder. */
export const NumberInput: Story = {
  args: {
    property: numberProperty,
  },
};

/** Select property shows a searchable option dropdown. */
export const SelectDropdown: Story = {
  args: {
    property: selectProperty,
  },
};

/** Multi-select property shows the same searchable option dropdown. */
export const MultiSelectDropdown: Story = {
  args: {
    property: multiSelectProperty,
  },
};

/** Status property shows a searchable option dropdown (same as select). */
export const StatusDropdown: Story = {
  args: {
    property: statusProperty,
  },
};

/** Date property shows a calendar date picker. */
export const DateCalendar: Story = {
  args: {
    property: dateProperty,
  },
};

/** URL property falls through to the default text input. */
export const UrlInput: Story = {
  args: {
    property: urlProperty,
  },
};

/** Select with no options configured shows "No options" message. */
export const SelectEmpty: Story = {
  args: {
    property: {
      ...selectProperty,
      config: {},
    },
  },
};

/** Interactive text input with controlled state. */
export const InteractiveText: Story = {
  render: function InteractiveTextEditor() {
    const [value, setValue] = useState("");

    return (
      <FilterValueEditor
        property={textProperty}
        valueInput={value}
        onValueInputChange={setValue}
        onSubmit={() => alert(`Submitted: ${value}`)}
        onSelectValue={fn()}
        onClose={fn()}
      />
    );
  },
};

// ---------------------------------------------------------------------------
// PropertyPicker stories
// ---------------------------------------------------------------------------

export const PropertyPickerDefault: StoryObj<typeof PropertyPicker> = {
  render: () => (
    <PropertyPicker properties={allProperties} onSelect={fn()} />
  ),
  name: "PropertyPicker",
};

// ---------------------------------------------------------------------------
// OperatorPicker stories
// ---------------------------------------------------------------------------

export const OperatorPickerText: StoryObj<typeof OperatorPicker> = {
  render: () => <OperatorPicker propertyType="text" onSelect={fn()} />,
  name: "OperatorPicker / Text",
};

export const OperatorPickerNumber: StoryObj<typeof OperatorPicker> = {
  render: () => <OperatorPicker propertyType="number" onSelect={fn()} />,
  name: "OperatorPicker / Number",
};

export const OperatorPickerCheckbox: StoryObj<typeof OperatorPicker> = {
  render: () => <OperatorPicker propertyType="checkbox" onSelect={fn()} />,
  name: "OperatorPicker / Checkbox",
};

export const OperatorPickerDate: StoryObj<typeof OperatorPicker> = {
  render: () => <OperatorPicker propertyType="date" onSelect={fn()} />,
  name: "OperatorPicker / Date",
};

export const OperatorPickerSelect: StoryObj<typeof OperatorPicker> = {
  render: () => <OperatorPicker propertyType="select" onSelect={fn()} />,
  name: "OperatorPicker / Select",
};
