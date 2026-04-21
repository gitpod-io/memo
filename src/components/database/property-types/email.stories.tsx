import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { EmailRenderer, EmailEditor } from "./email";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Email",
  type: "email",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof EmailRenderer> = {
  title: "Database/PropertyTypes/Email/Renderer",
  component: EmailRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof EmailRenderer>;

export const Default: Story = {
  args: {
    value: { email: "alice@example.com" },
    property: mockProperty,
  },
};

export const LongEmail: Story = {
  args: {
    value: { email: "very.long.email.address@subdomain.example.com" },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function EmailEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    email: "alice@example.com",
  });
  return (
    <div className="w-48 bg-background p-2">
      <EmailEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <EmailEditorDemo />,
};
