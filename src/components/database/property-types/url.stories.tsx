import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { UrlRenderer, UrlEditor } from "./url";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Website",
  type: "url",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof UrlRenderer> = {
  title: "Database/PropertyTypes/URL/Renderer",
  component: UrlRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof UrlRenderer>;

export const Default: Story = {
  args: {
    value: { url: "https://example.com/docs/getting-started" },
    property: mockProperty,
  },
};

export const ShortUrl: Story = {
  args: {
    value: { url: "https://memo.dev" },
    property: mockProperty,
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: mockProperty,
  },
};

function UrlEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    url: "https://example.com",
  });
  return (
    <div className="w-48 bg-background p-2">
      <UrlEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <UrlEditorDemo />,
};
