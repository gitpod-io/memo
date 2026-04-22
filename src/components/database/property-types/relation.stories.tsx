import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { DatabaseProperty } from "@/lib/types";
import { RelationRenderer, RelationEditor } from "./relation";

// ---------------------------------------------------------------------------
// Mock property
// ---------------------------------------------------------------------------

const mockProperty: DatabaseProperty = {
  id: "prop-relation-1",
  database_id: "db-1",
  name: "Related Tasks",
  type: "relation",
  config: { database_id: "target-db-1" },
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockPropertyNoTarget: DatabaseProperty = {
  ...mockProperty,
  id: "prop-relation-no-target",
  name: "Unconfigured Relation",
  config: {},
};

// ---------------------------------------------------------------------------
// Renderer stories
// ---------------------------------------------------------------------------

const rendererMeta: Meta<typeof RelationRenderer> = {
  title: "Database/PropertyTypes/Relation/Renderer",
  component: RelationRenderer,
  decorators: [
    (Story) => (
      <div className="w-64 bg-background p-2">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Renders linked page pills for relation property values. " +
          "In Storybook, pills show loading skeletons since Supabase is unavailable.",
      },
    },
  },
};

export { rendererMeta as default };
type RendererStory = StoryObj<typeof RelationRenderer>;

export const SingleRelation: RendererStory = {
  args: {
    value: { page_ids: ["page-1"] },
    property: mockProperty,
  },
};

export const MultipleRelations: RendererStory = {
  args: {
    value: { page_ids: ["page-1", "page-2", "page-3"] },
    property: mockProperty,
  },
};

export const Empty: RendererStory = {
  args: {
    value: {},
    property: mockProperty,
  },
};

export const EmptyArray: RendererStory = {
  args: {
    value: { page_ids: [] },
    property: mockProperty,
  },
};

// ---------------------------------------------------------------------------
// Editor stories
// ---------------------------------------------------------------------------

function EditorDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({
    page_ids: ["page-1"],
  });
  return (
    <div className="w-64 bg-background p-2">
      <RelationEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const Editor: RendererStory = {
  render: () => <EditorDemo />,
};

function EditorEmptyDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div className="w-64 bg-background p-2">
      <RelationEditor
        value={value}
        property={mockProperty}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const EditorEmpty: RendererStory = {
  render: () => <EditorEmptyDemo />,
};

function EditorNoTargetDemo() {
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div className="w-64 bg-background p-2">
      <RelationEditor
        value={value}
        property={mockPropertyNoTarget}
        onChange={setValue}
        onBlur={fn()}
      />
    </div>
  );
}

export const EditorNoTarget: RendererStory = {
  render: () => <EditorNoTargetDemo />,
};
