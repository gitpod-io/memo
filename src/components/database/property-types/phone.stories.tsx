import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { PhoneRenderer, PhoneEditor } from "./phone";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Phone",
  type: "phone",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof PhoneRenderer> = {
  title: "Database/PropertyTypes/Phone/Renderer",
  component: PhoneRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof PhoneRenderer>;

export const USFormat: Story = {
  args: {
    value: { phone: "5551234567" },
    property: mockProperty,
  },
};

export const USWithCountryCode: Story = {
  args: {
    value: { phone: "15551234567" },
    property: mockProperty,
  },
};

export const International: Story = {
  args: {
    value: { phone: "+44 20 7946 0958" },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function PhoneEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    phone: "5551234567",
  });
  return (
    <div className="w-48 bg-background p-2">
      <PhoneEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <PhoneEditorDemo />,
};
