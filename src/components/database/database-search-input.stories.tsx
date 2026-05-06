import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { DatabaseSearchInput } from "./database-search-input";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof DatabaseSearchInput> = {
  title: "Database/DatabaseSearchInput",
  component: DatabaseSearchInput,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    onChange: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof DatabaseSearchInput>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Empty state — shows placeholder text and magnifying glass icon. */
export const Empty: Story = {
  args: {
    value: "",
  },
};

/** With search text — shows the clear button. */
export const WithValue: Story = {
  args: {
    value: "design doc",
  },
};

/** Interactive story with state management. */
export const Interactive: Story = {
  render: function InteractiveSearch() {
    const [value, setValue] = useState("");

    return (
      <div className="space-y-4">
        <DatabaseSearchInput value={value} onChange={setValue} />
        <div className="text-xs text-muted-foreground">
          Search query: {value ? `"${value}"` : "(empty)"}
        </div>
      </div>
    );
  },
};

/** In toolbar context — shows how the search input sits alongside other toolbar elements. */
export const InToolbar: Story = {
  render: function ToolbarContext() {
    const [value, setValue] = useState("");

    return (
      <div className="flex items-center gap-1 p-2">
        <DatabaseSearchInput value={value} onChange={setValue} />
        <div className="text-xs text-muted-foreground">+ Sort</div>
        <div className="text-xs text-muted-foreground">+ Filter</div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">Export</div>
      </div>
    );
  },
};
