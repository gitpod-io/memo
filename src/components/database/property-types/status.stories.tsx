import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { StatusRenderer, StatusEditor, DEFAULT_STATUS_OPTIONS } from "./status";

function makeProp(
  options = DEFAULT_STATUS_OPTIONS,
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Stage",
    type: "status",
    config: { options },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const meta: Meta<typeof StatusRenderer> = {
  title: "Database/PropertyTypes/Status/Renderer",
  component: StatusRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof StatusRenderer>;

export const NotStarted: Story = {
  args: {
    value: { option_id: "status-not-started" },
    property: makeProp(),
  },
};

export const InProgress: Story = {
  args: {
    value: { option_id: "status-in-progress" },
    property: makeProp(),
  },
};

export const Done: Story = {
  args: {
    value: { option_id: "status-done" },
    property: makeProp(),
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: makeProp(),
  },
};

export const DefaultsWithNoConfig: Story = {
  name: "Defaults (empty config)",
  args: {
    value: { option_id: "status-in-progress" },
    property: makeProp([]),
  },
};

function StatusEditorDemo() {
  const prop = makeProp();
  const [value, setValue] = useState<Record<string, unknown>>({
    option_id: "status-not-started",
  });
  return (
    <div className="w-64 bg-background p-2">
      <StatusEditor
        value={value}
        property={prop}
        onChange={setValue}
        onBlur={() => {}}
      />
    </div>
  );
}

export const Editor: Story = {
  render: () => <StatusEditorDemo />,
};
