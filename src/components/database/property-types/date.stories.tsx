import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { DateRenderer, DateEditor } from "./date";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Due Date",
  type: "date",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof DateRenderer> = {
  title: "Database/PropertyTypes/Date/Renderer",
  component: DateRenderer,
  decorators: [
    (Story) => (
      <div className="w-56 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof DateRenderer>;

export const Default: Story = {
  args: {
    value: { date: "2026-04-21" },
    property: mockProperty,
  },
};

export const DateRange: Story = {
  args: {
    value: { date: "2026-04-21", end_date: "2026-05-15" },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function DateEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    date: "2026-04-21",
  });
  return (
    <div className="w-72 bg-background p-2">
      <DateEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <DateEditorDemo />,
};

function DateEditorEmptyDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div className="w-72 bg-background p-2">
      <DateEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const EditorNoDate: Story = {
  render: () => <DateEditorEmptyDemo />,
};
