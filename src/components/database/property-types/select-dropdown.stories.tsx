import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { SelectOption } from "@/lib/types";
import { SelectDropdown } from "./select-dropdown";

const sampleOptions: SelectOption[] = [
  { id: "opt-1", name: "To Do", color: "gray" },
  { id: "opt-2", name: "In Progress", color: "blue" },
  { id: "opt-3", name: "Done", color: "green" },
  { id: "opt-4", name: "Blocked", color: "red" },
  { id: "opt-5", name: "Review", color: "purple" },
];

const meta: Meta<typeof SelectDropdown> = {
  title: "Database/PropertyTypes/SelectDropdown",
  component: SelectDropdown,
  args: {
    onSelect: fn(),
    onDeselect: fn(),
    onCreate: fn(),
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-64 bg-background p-4">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof SelectDropdown>;

// -- Default empty state (no options) --

export const EmptyState: Story = {
  args: {
    options: [],
    selected: [],
    multi: false,
  },
};

// -- Single-select with options --

export const SingleSelect: Story = {
  args: {
    options: sampleOptions,
    selected: ["opt-2"],
    multi: false,
  },
};

export const SingleSelectNoneSelected: Story = {
  args: {
    options: sampleOptions,
    selected: [],
    multi: false,
  },
};

// -- Multi-select with options --

export const MultiSelect: Story = {
  args: {
    options: sampleOptions,
    selected: ["opt-1", "opt-3"],
    multi: true,
  },
};

export const MultiSelectAllSelected: Story = {
  args: {
    options: sampleOptions,
    selected: sampleOptions.map((o) => o.id),
    multi: true,
  },
};

// -- Option color display (all colors visible) --

const allColorOptions: SelectOption[] = [
  { id: "c-gray", name: "Gray", color: "gray" },
  { id: "c-blue", name: "Blue", color: "blue" },
  { id: "c-green", name: "Green", color: "green" },
  { id: "c-yellow", name: "Yellow", color: "yellow" },
  { id: "c-orange", name: "Orange", color: "orange" },
  { id: "c-red", name: "Red", color: "red" },
  { id: "c-purple", name: "Purple", color: "purple" },
  { id: "c-pink", name: "Pink", color: "pink" },
  { id: "c-cyan", name: "Cyan", color: "cyan" },
];

export const AllColors: Story = {
  args: {
    options: allColorOptions,
    selected: [],
    multi: false,
  },
};

export const AllColorsWithColorPicker: Story = {
  args: {
    options: allColorOptions,
    selected: ["c-blue"],
    multi: false,
    onColorChange: fn(),
  },
};

// -- Create new option inline (search text with no match) --

function CreateInlineDemo() {
  const [options, setOptions] = useState<SelectOption[]>([...sampleOptions]);
  const [selected, setSelected] = useState<string[]>(["opt-1"]);

  return (
    <SelectDropdown
      options={options}
      selected={selected}
      multi={false}
      onSelect={(id) => setSelected([id])}
      onDeselect={() => setSelected([])}
      onCreate={(name) => {
        const newOpt: SelectOption = {
          id: `opt-${Date.now()}`,
          name,
          color: "cyan",
        };
        setOptions((prev) => [...prev, newOpt]);
        setSelected([newOpt.id]);
      }}
      onClose={() => {}}
    />
  );
}

export const CreateInline: Story = {
  render: () => <CreateInlineDemo />,
};

function MultiSelectCreateDemo() {
  const [options, setOptions] = useState<SelectOption[]>([...sampleOptions]);
  const [selected, setSelected] = useState<string[]>(["opt-1", "opt-3"]);

  return (
    <SelectDropdown
      options={options}
      selected={selected}
      multi={true}
      onSelect={(id) => setSelected((prev) => [...prev, id])}
      onDeselect={(id) => setSelected((prev) => prev.filter((s) => s !== id))}
      onCreate={(name) => {
        const newOpt: SelectOption = {
          id: `opt-${Date.now()}`,
          name,
          color: "pink",
        };
        setOptions((prev) => [...prev, newOpt]);
        setSelected((prev) => [...prev, newOpt.id]);
      }}
      onClose={() => {}}
    />
  );
}

export const MultiSelectCreateInline: Story = {
  render: () => <MultiSelectCreateDemo />,
};
