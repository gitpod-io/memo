import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ViewTabs } from "./view-tabs";
import type { DatabaseView } from "@/lib/types";

// DatabaseViewClient depends on next/navigation, Supabase, and dynamic imports.
// These stories render the visual layout states using ViewTabs + skeleton/placeholder
// compositions that match the actual component rendering.

const mockViews: DatabaseView[] = [
  {
    id: "view-1",
    database_id: "db-1",
    name: "Default view",
    type: "table",
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "view-2",
    database_id: "db-1",
    name: "Board",
    type: "board",
    config: {},
    position: 1,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

const meta: Meta = {
  title: "Database/DatabaseViewClient",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

export const Loading: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Title skeleton */}
      <div className="h-9 w-1/3 animate-pulse bg-muted" />
      {/* View tabs skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-overlay-border pb-2">
          <div className="h-5 w-20 animate-pulse bg-muted" />
          <div className="h-5 w-20 animate-pulse bg-muted" />
          <div className="h-5 w-20 animate-pulse bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="h-8 w-1/4 animate-pulse bg-muted" />
            <div className="h-8 w-1/4 animate-pulse bg-muted" />
            <div className="h-8 w-1/4 animate-pulse bg-muted" />
            <div className="h-8 w-1/4 animate-pulse bg-muted" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-10 w-1/4 animate-pulse bg-muted" />
              <div className="h-10 w-1/4 animate-pulse bg-muted" />
              <div className="h-10 w-1/4 animate-pulse bg-muted" />
              <div className="h-10 w-1/4 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

export const WithViewTabs: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Simulated page header */}
      <div>
        <span className="text-3xl">📊</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">
          Project Tracker
        </h1>
      </div>
      {/* View tabs + placeholder grid */}
      <div>
        <ViewTabs
          views={mockViews}
          activeViewId="view-1"
          onViewChange={fn()}
          onAddView={fn()}
        />
        <div className="mt-4 text-sm text-muted-foreground">
          Table view renders here
        </div>
      </div>
    </div>
  ),
};

export const ComingSoonView: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <span className="text-3xl">📊</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">
          Project Tracker
        </h1>
      </div>
      <div>
        <ViewTabs
          views={mockViews}
          activeViewId="view-2"
          onViewChange={fn()}
          onAddView={fn()}
        />
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Board view coming soon
        </div>
      </div>
    </div>
  ),
};
