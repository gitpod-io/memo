import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { TextRenderer, TextEditor } from "./text";

const mockProperty: DatabaseProperty = {
  id: "prop-1",
  database_id: "db-1",
  name: "Description",
  type: "text",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// -- Renderer stories --

const rendererMeta: Meta<typeof TextRenderer> = {
  title: "Database/PropertyTypes/Text/Renderer",
  component: TextRenderer,
  decorators: [
    (Story) => (
      <div className="w-48 bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export { rendererMeta as default };
type RendererStory = StoryObj<typeof TextRenderer>;

export const Default: RendererStory = {
  args: {
    value: { text: "Hello world" },
    property: mockProperty,
  },
};

export const LongText: RendererStory = {
  args: {
    value: {
      text: "This is a very long text value that should be truncated when it overflows the cell width",
    },
    property: mockProperty,
  },
};

export const Empty: RendererStory = {
  args: {
    value: {},
    property: mockProperty,
  },
};

// -- Editor story (separate file would be cleaner, but co-located for simplicity) --

function TextEditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    text: "Edit me",
  });
  return (
    <div className="w-48 bg-background p-2">
      <TextEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: RendererStory = {
  render: () => <TextEditorDemo />,
};

export const EditorEmpty: RendererStory = {
  render: () => {
    function Demo() {
      const [value, setValue] = useState<Record<string, unknown>>({});
      return (
        <div className="w-48 bg-background p-2">
          <TextEditor
            value={value}
            property={mockProperty}
            onChange={setValue}
            onBlur={fn()}
          />
        </div>
      );
    }
    return <Demo />;
  },
};
