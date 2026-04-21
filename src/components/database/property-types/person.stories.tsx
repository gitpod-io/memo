import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DatabaseProperty } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonRenderer } from "./person";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMembers = [
  {
    id: "user-1",
    display_name: "Alice Johnson",
    email: "alice@example.com",
    avatar_url: null,
  },
  {
    id: "user-2",
    display_name: "Bob Smith",
    email: "bob@example.com",
    avatar_url: null,
  },
  {
    id: "user-3",
    display_name: "Carol Williams",
    email: "carol@example.com",
    avatar_url: null,
  },
  {
    id: "user-4",
    display_name: "Dan Brown",
    email: "dan@example.com",
    avatar_url: null,
  },
  {
    id: "user-5",
    display_name: "Eve Davis",
    email: "eve@example.com",
    avatar_url: null,
  },
];

function makeProp(members = mockMembers): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Assignee",
    type: "person",
    config: { _members: members },
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Renderer stories
// ---------------------------------------------------------------------------

const meta: Meta<typeof PersonRenderer> = {
  title: "Database/PropertyTypes/Person/Renderer",
  component: PersonRenderer,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="w-48 bg-background p-2">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof PersonRenderer>;

export const SinglePerson: Story = {
  args: {
    value: { user_ids: ["user-1"] },
    property: makeProp(),
  },
};

export const MultiplePeople: Story = {
  args: {
    value: { user_ids: ["user-1", "user-2", "user-3"] },
    property: makeProp(),
  },
};

export const ManyPeople: Story = {
  args: {
    value: { user_ids: ["user-1", "user-2", "user-3", "user-4", "user-5"] },
    property: makeProp(),
  },
};

export const Empty: Story = {
  args: {
    value: {},
    property: makeProp(),
  },
};

export const EmptyUserIds: Story = {
  args: {
    value: { user_ids: [] },
    property: makeProp(),
  },
};

export const UnknownUser: Story = {
  name: "Unknown User ID",
  args: {
    value: { user_ids: ["user-unknown"] },
    property: makeProp(),
  },
};

// ---------------------------------------------------------------------------
// Editor story — uses mock data, does not call Supabase
// ---------------------------------------------------------------------------

function PersonEditorDemo() {
  const prop = makeProp();
  const [value, setValue] = useState<Record<string, unknown>>({
    user_ids: ["user-1"],
  });
  return (
    <div className="w-64 bg-background p-2">
      <p className="mb-2 text-xs text-muted-foreground">
        Editor requires Supabase — showing renderer with current selection:
      </p>
      <PersonRenderer value={value} property={prop} />
      <p className="mt-2 text-xs text-muted-foreground">
        Selected: {JSON.stringify((value.user_ids as string[]) ?? [])}
      </p>
      <button
        type="button"
        className="mt-2 text-xs text-accent hover:underline"
        onClick={() => {
          const current = (value.user_ids as string[]) ?? [];
          const next = current.includes("user-2")
            ? current.filter((id) => id !== "user-2")
            : [...current, "user-2"];
          setValue({ user_ids: next });
        }}
      >
        Toggle Bob Smith
      </button>
    </div>
  );
}

export const EditorPreview: Story = {
  render: () => (
    <TooltipProvider>
      <PersonEditorDemo />
    </TooltipProvider>
  ),
};
