import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { MultiSelectRenderer, MultiSelectEditor } from "./multi-select";

const sampleOptions: SelectOption[] = [
  { id: "opt-1", name: "Frontend", color: "blue" },
  { id: "opt-2", name: "Backend", color: "green" },
  { id: "opt-3", name: "Design", color: "purple" },
  { id: "opt-4", name: "DevOps", color: "orange" },
  { id: "opt-5", name: "QA", color: "cyan" },
];

function makeProp(options: SelectOption[] = sampleOptions): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Tags",
    type: "multi_select",
    config: { options },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const meta: Meta<typeof MultiSelectRenderer> = {
  title: "Database/PropertyTypes/MultiSelect/Renderer",
  component: MultiSelectRenderer,
  decorators: [
    (Story) => (
      <div className="w-64 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof MultiSelectRenderer>;

export const SingleTag: Story = {
  args: {
    value: { option_ids: ["opt-1"] },
    property: makeProp(),
  },
};

export const MultipleTags: Story = {
  args: {
    value: { option_ids: ["opt-1", "opt-2", "opt-3"] },
    property: makeProp(),
  },
};

export const AllTags: Story = {
  args: {
    value: { option_ids: ["opt-1", "opt-2", "opt-3", "opt-4", "opt-5"] },
    property: makeProp(),
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: makeProp(),
  },
};

function MultiSelectEditorDemo() {
  const prop = makeProp();
  const [value, setValue] = useState<Record<string, unknown>>({
    option_ids: ["opt-1", "opt-3"],
  });
  return (
    <div className="w-64 bg-background p-2">
      <MultiSelectEditor
        value={value}
        property={prop}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <MultiSelectEditorDemo />,
};
