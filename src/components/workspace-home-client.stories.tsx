import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Clock, Table2 } from "lucide-react";

// WorkspaceHomeClient is a thin dynamic import wrapper for WorkspaceHome.
// Stories show the visual layout of the workspace home page.

const meta: Meta = {
  title: "Components/WorkspaceHomeClient",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Workspace home with recent pages and all pages. */
export const Default: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <h1 className="text-2xl font-semibold text-foreground">My Workspace</h1>
      {/* Recent visits */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          Recently visited
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { title: "Meeting Notes", icon: "📝" },
            { title: "Project Tasks", icon: "📊" },
            { title: "Design Spec", icon: "🎨" },
          ].map((page) => (
            <div
              key={page.title}
              className="flex items-center gap-2 rounded-sm border border-overlay-border p-3 hover:bg-overlay-hover"
            >
              <span className="text-lg">{page.icon}</span>
              <span className="truncate text-sm font-medium text-foreground">
                {page.title}
              </span>
            </div>
          ))}
        </div>
      </section>
      {/* All pages */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">
          All pages
        </h2>
        <div className="mt-3 space-y-1">
          {[
            { title: "Meeting Notes", icon: "📝", isDb: false, updated: "2 hours ago" },
            { title: "Project Tasks", icon: "📊", isDb: true, updated: "Yesterday" },
            { title: "Design Spec", icon: "🎨", isDb: false, updated: "3 days ago" },
            { title: "Reading List", icon: "📚", isDb: true, updated: "Last week" },
          ].map((page) => (
            <div
              key={page.title}
              className="flex items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-overlay-hover"
            >
              <span className="text-base">{page.icon}</span>
              <span className="flex-1 truncate text-sm text-foreground">
                {page.title}
              </span>
              {page.isDb && (
                <Table2 className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {page.updated}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
};

/** Empty workspace — no pages yet. */
export const EmptyWorkspace: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <h1 className="text-2xl font-semibold text-foreground">My Workspace</h1>
      <div className="mt-12 flex flex-col items-center gap-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No pages yet. Create your first page to get started.
        </p>
        <button
          type="button"
          className="h-9 rounded-sm bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          New page
        </button>
      </div>
    </div>
  ),
};

/** Loading state. */
export const Loading: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-sm bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  ),
};
