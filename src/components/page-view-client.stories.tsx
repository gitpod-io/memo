import type { Meta, StoryObj } from "@storybook/react";
import { History, MoreHorizontal } from "lucide-react";

// PageViewClient renders the page view with title, icon, cover, editor,
// page menu, and version history panel. It requires Supabase and router
// context — stories show the static visual layout.

const meta: Meta = {
  title: "Components/PageViewClient",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Default page view with title, icon, and editor content. */
export const Default: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">📝</span>
          <h1 className="text-3xl font-bold text-foreground">
            Project Notes
          </h1>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
          aria-label="Page menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-6 space-y-3 text-sm text-foreground">
        <p>
          This is the main page content rendered by the Lexical editor.
        </p>
        <p>
          The page view includes the title, icon, optional cover image, and
          the editor area.
        </p>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        30 words · 1 min read
      </div>
    </div>
  ),
};

/** Page with cover image. */
export const WithCover: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background">
      <div className="h-48 w-full bg-gradient-to-r from-accent/20 to-accent/5" />
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎨</span>
            <h1 className="text-3xl font-bold text-foreground">
              Design System
            </h1>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
            aria-label="Page menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 space-y-3 text-sm text-foreground">
          <p>Page content with a cover image above.</p>
        </div>
      </div>
    </div>
  ),
};

/** Page with version history panel open. */
export const WithVersionHistory: Story = {
  render: () => (
    <div className="flex gap-0">
      <div className="flex-1 bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📝</span>
            <h1 className="text-3xl font-bold text-foreground">
              Project Notes
            </h1>
          </div>
          <div className="mt-6 text-sm text-foreground">
            <p>Editor content (may show a preview version).</p>
          </div>
        </div>
      </div>
      <div className="w-72 border-l border-overlay-border bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">
            Version history
          </h3>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="space-y-2">
          {["2 minutes ago", "1 hour ago", "Yesterday"].map((time) => (
            <button
              key={time}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover"
            >
              <History className="h-3 w-3" />
              <span>{time}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ),
};

/** Loading state — skeleton while dynamic imports resolve. */
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
