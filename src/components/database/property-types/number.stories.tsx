import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { NumberRenderer, NumberEditor } from "./number";

function makeProp(format?: string): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Amount",
    type: "number",
    config: format ? { format } : {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const meta: Meta<typeof NumberRenderer> = {
  title: "Database/PropertyTypes/Number/Renderer",
  component: NumberRenderer,
  decorators: [
    (Story) => (
      <div className="w-32 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof NumberRenderer>;

export const Default: Story = {
  args: {
    value: { number: 1234.56 },
    property: makeProp(),
  },
};

export const Currency: Story = {
  args: {
    value: { number: 99.99 },
    property: makeProp("currency"),
  },
};

export const Percent: Story = {
  args: {
    value: { number: 0.85 },
    property: makeProp("percent"),
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: makeProp(),
  },
};

export const Zero: Story = {
  args: {
    value: { number: 0 },
    property: makeProp(),
  },
};

function NumberEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    number: 42,
  });
  return (
    <div className="w-32 bg-background p-2">
      <NumberEditor
        value={value}
        property={makeProp()}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <NumberEditorDemo />,
};
