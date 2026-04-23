import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { SelectRenderer, SelectEditor } from "./select";

const sampleOptions: SelectOption[] = [
  { id: "opt-1", name: "To Do", color: "gray" },
  { id: "opt-2", name: "In Progress", color: "blue" },
  { id: "opt-3", name: "Done", color: "green" },
  { id: "opt-4", name: "Blocked", color: "red" },
];

function makeProp(options: SelectOption[] = sampleOptions): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: { options },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const meta: Meta<typeof SelectRenderer> = {
  title: "Database/PropertyTypes/Select/Renderer",
  component: SelectRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof SelectRenderer>;

export const Default: Story = {
  args: {
    value: { option_id: "opt-2" },
    property: makeProp(),
  },
};

export const GrayOption: Story = {
  args: {
    value: { option_id: "opt-1" },
    property: makeProp(),
  },
};

export const GreenOption: Story = {
  args: {
    value: { option_id: "opt-3" },
    property: makeProp(),
  },
};

export const RedOption: Story = {
  args: {
    value: { option_id: "opt-4" },
    property: makeProp(),
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: makeProp(),
  },
};

function SelectEditorDemo() {
  const prop = makeProp();
  const [value, setValue] = useState<Record<string, unknown>>({
    option_id: "opt-1",
  });
  return (
    <div className="w-64 bg-background p-2">
      <SelectEditor
        value={value}
        property={prop}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <SelectEditorDemo />,
};

function SelectEditorEmptyDemo() {
  const [prop, setProp] = useState(makeProp());
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div className="w-64 bg-background p-2">
      <SelectEditor
        value={value}
        property={prop}
        onChange={(v) => {
          setValue(v);
          // Simulate parent persisting _newOptions to property config
          if (v._newOptions) {
            setProp((prev) => ({
              ...prev,
              config: { ...prev.config, options: v._newOptions },
            }));
          }
        }}
        onBlur={() => {}}
      />
    </div>
  );
}

export const EditorNoSelection: Story = {
  render: () => <SelectEditorEmptyDemo />,
};
