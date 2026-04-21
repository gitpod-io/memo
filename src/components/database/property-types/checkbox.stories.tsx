import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { CheckboxRenderer, CheckboxEditor } from "./checkbox";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Done",
  type: "checkbox",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof CheckboxRenderer> = {
  title: "Database/PropertyTypes/Checkbox/Renderer",
  component: CheckboxRenderer,
  decorators: [
    (Story) => (
      <div className="flex h-10 w-16 items-center bg-background">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof CheckboxRenderer>;

export const Checked: Story = {
  args: {
    value: { checked: true },
    property: mockProperty,
  },
};

export const Unchecked: Story = {
  args: {
    value: { checked: false },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function CheckboxEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    checked: false,
  });
  return (
    <div className="flex h-10 w-16 items-center bg-background">
      <CheckboxEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <CheckboxEditorDemo />,
};
