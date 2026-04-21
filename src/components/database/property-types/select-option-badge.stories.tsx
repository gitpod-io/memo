import type { Meta, StoryObj } from "@storybook/react";
import { SelectOptionBadge } from "./select-option-badge";
import { SELECT_OPTION_COLORS } from "./index";

const meta: Meta<typeof SelectOptionBadge> = {
  title: "Database/PropertyTypes/SelectOptionBadge",
  component: SelectOptionBadge,
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof SelectOptionBadge>;

export const Gray: Story = {
  args: { name: "To Do", color: "gray" },
};

export const Blue: Story = {
  args: { name: "In Progress", color: "blue" },
};

export const Green: Story = {
  args: { name: "Done", color: "green" },
};

export const Red: Story = {
  args: { name: "Blocked", color: "red" },
};

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {SELECT_OPTION_COLORS.map((color) => (
        <SelectOptionBadge
          key={color}
          name={color.charAt(0).toUpperCase() + color.slice(1)}
          color={color}
        />
      ))}
    </div>
  ),
};
