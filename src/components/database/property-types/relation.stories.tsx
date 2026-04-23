import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { FileText } from "lucide-react";
import type { DatabaseProperty } from "@/lib/types";
import { RelationEditor } from "./relation";

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
// Static RelationPill replica for Storybook (avoids useRouter/useParams)
// ---------------------------------------------------------------------------

function StaticRelationPill({
  title,
  icon,
  deleted,
}: {
  title: string;
  icon: string | null;
  deleted?: boolean;
}) {
  if (deleted) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground line-through align-baseline">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Deleted page
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-[160px] items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-foreground hover:bg-overlay-active align-baseline cursor-pointer">
      {icon ? (
        <span className="shrink-0 text-sm">{icon}</span>
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate underline decoration-muted-foreground/50 underline-offset-2">
        {title}
      </span>
    </span>
  );
}

function StaticLoadingPill() {
  return (
    <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground align-baseline">
      <span className="inline-block h-3.5 w-16 animate-pulse bg-overlay-active" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Renderer stories (static replicas — no Next.js router needed)
// ---------------------------------------------------------------------------

const rendererMeta: Meta = {
  title: "Database/PropertyTypes/Relation/Renderer",
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
          "Static visual replicas of RelationRenderer pills. " +
          "The actual component uses useRouter/useParams and Supabase, " +
          "so these stories render the same visual states with static data.",
      },
    },
  },
};

export { rendererMeta as default };
type Story = StoryObj;

export const SingleRelation: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1">
      <StaticRelationPill title="Project Overview" icon="📋" />
    </div>
  ),
};

export const MultipleRelations: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1">
      <StaticRelationPill title="Project Overview" icon="📋" />
      <StaticRelationPill title="Getting Started" icon={null} />
      <StaticRelationPill title="API Reference" icon="📖" />
    </div>
  ),
};

export const Empty: Story = {
  render: () => <div />,
};

export const EmptyArray: Story = {
  render: () => <div />,
};

export const DeletedPage: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1">
      <StaticRelationPill title="" icon={null} deleted />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1">
      <StaticLoadingPill />
      <StaticLoadingPill />
    </div>
  ),
};

export const LongTitle: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1">
      <StaticRelationPill
        title="This Is A Very Long Page Title That Should Truncate"
        icon="📝"
      />
    </div>
  ),
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

export const Editor: Story = {
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

export const EditorEmpty: Story = {
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

export const EditorNoTarget: Story = {
  render: () => <EditorNoTargetDemo />,
};
