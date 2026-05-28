import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PropertyVisibilityPanel } from "./property-visibility-panel";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProperties: DatabaseProperty[] = [
  {
    id: "prop-title",
    database_id: "db-1",
    name: "Title",
    type: "text",
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "status",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-priority",
    database_id: "db-1",
    name: "Priority",
    type: "select",
    config: {},
    position: 2,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-assignee",
    database_id: "db-1",
    name: "Assignee",
    type: "person",
    config: {},
    position: 3,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-due-date",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 4,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop-email",
    database_id: "db-1",
    name: "Email",
    type: "email",
    config: {},
    position: 5,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof PropertyVisibilityPanel> = {
  title: "Database/PropertyVisibilityPanel",
  component: PropertyVisibilityPanel,
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj<typeof PropertyVisibilityPanel>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** All properties visible (default state — no visible_properties set) */
export const AllVisible: Story = {
  render: function AllVisibleStory() {
    const [visibleIds, setVisibleIds] = useState<string[] | undefined>(
      undefined,
    );
    return (
      <PropertyVisibilityPanel
        properties={mockProperties}
        visiblePropertyIds={visibleIds}
        onVisibilityChange={setVisibleIds}
      />
    );
  },
};

/** Some properties hidden */
export const SomeHidden: Story = {
  render: function SomeHiddenStory() {
    const [visibleIds, setVisibleIds] = useState<string[]>([
      "prop-status",
      "prop-priority",
    ]);
    return (
      <PropertyVisibilityPanel
        properties={mockProperties}
        visiblePropertyIds={visibleIds}
        onVisibilityChange={setVisibleIds}
      />
    );
  },
};

/** Only one property visible */
export const SingleVisible: Story = {
  render: function SingleVisibleStory() {
    const [visibleIds, setVisibleIds] = useState<string[]>(["prop-status"]);
    return (
      <PropertyVisibilityPanel
        properties={mockProperties}
        visiblePropertyIds={visibleIds}
        onVisibilityChange={setVisibleIds}
      />
    );
  },
};

/** Reorder interaction — drag properties to reorder */
export const ReorderInteraction: Story = {
  render: function ReorderStory() {
    const [visibleIds, setVisibleIds] = useState<string[]>([
      "prop-due-date",
      "prop-status",
      "prop-assignee",
      "prop-priority",
      "prop-email",
    ]);
    return (
      <div>
        <p className="mb-4 text-xs text-muted-foreground">
          Drag properties to reorder. Toggle switches to show/hide.
        </p>
        <PropertyVisibilityPanel
          properties={mockProperties}
          visiblePropertyIds={visibleIds}
          onVisibilityChange={setVisibleIds}
        />
      </div>
    );
  },
};
