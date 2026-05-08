import type { Meta, StoryObj } from "@storybook/react";

// PageContentClient is a client wrapper that dynamically imports
// DatabaseViewClient, RowPropertiesHeader, and PageViewClient based on
// page type (database, row, or regular page). Stories show the loading
// states and layout for each page type.

const meta: Meta = {
  title: "Components/PageContentClient",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Regular page — editor with title, icon, and cover. */
export const RegularPage: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      {/* Cover placeholder */}
      <div className="h-48 w-full rounded-sm bg-muted" />
      {/* Icon + Title */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-4xl">📝</span>
        <h1 className="text-3xl font-bold text-foreground">Meeting Notes</h1>
      </div>
      {/* Editor placeholder */}
      <div className="mt-6 space-y-3 text-sm text-foreground">
        <p>
          This is the page content area where the Lexical editor renders.
        </p>
        <p>
          The editor supports headings, lists, code blocks, images, callouts,
          and more.
        </p>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        28 words · 1 min read
      </div>
    </div>
  ),
};

/** Database page — shows database view instead of editor. */
export const DatabasePage: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">📊</span>
        <h1 className="text-3xl font-bold text-foreground">Project Tasks</h1>
      </div>
      {/* Database view placeholder */}
      <div className="mt-6 space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  ),
};

/** Row page — shows property header above editor. */
export const RowPage: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">📋</span>
        <h1 className="text-3xl font-bold text-foreground">
          Design homepage layout
        </h1>
      </div>
      {/* Row properties header */}
      <div className="mt-4 space-y-2 rounded-sm border border-overlay-border p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="w-24 text-muted-foreground">Status</span>
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
            Done
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="w-24 text-muted-foreground">Priority</span>
          <span className="text-foreground">High</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="w-24 text-muted-foreground">Assignee</span>
          <span className="text-foreground">Alice</span>
        </div>
      </div>
      {/* Editor content */}
      <div className="mt-6 space-y-3 text-sm text-foreground">
        <p>Task description and notes go here.</p>
      </div>
    </div>
  ),
};

/** Loading state — skeleton placeholders while dynamic imports resolve. */
export const Loading: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse bg-muted" />
          <div className="h-4 w-5/6 animate-pulse bg-muted" />
          <div className="h-4 w-4/6 animate-pulse bg-muted" />
        </div>
      </div>
    </div>
  ),
};
