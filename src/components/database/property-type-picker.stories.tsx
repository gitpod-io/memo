import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { PropertyTypePicker } from "./property-type-picker";

const meta: Meta<typeof PropertyTypePicker> = {
  title: "Database/PropertyTypePicker",
  component: PropertyTypePicker,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="flex h-10 w-12 items-center justify-center border border-overlay-border bg-muted">
        <Story />
      </div>
    ),
  ],
  args: {
    onSelect: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof PropertyTypePicker>;

/** Default state — shows the + trigger button. */
export const Default: Story = {};
