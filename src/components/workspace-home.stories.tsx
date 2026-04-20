import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";

const meta: Meta = {
  title: "Components/WorkspaceHome",
  parameters: {
    layout: "fullscreen",
  },
};

export { meta as default };

type Story = StoryObj;

const mockPages = [
  {
    id: "p1",
    title: "Getting Started",
    icon: "🚀",
    updated_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: "p2",
    title: "API Reference",
    icon: null,
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: "p3",
    title: "Design System",
    icon: "🎨",
    updated_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: "p4",
    title: "",
    icon: null,
    updated_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
];

// WorkspaceHome uses next/navigation and Supabase. These stories
// render the visual appearance with static data.
export const WithPages: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Workspace</h1>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-0.5">
        {mockPages.map((page) => (
          <button
            key={page.id}
            className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.04]"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {page.icon ? (
                <span className="text-sm">{page.icon}</span>
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="flex-1 truncate">
              {page.title || "Untitled"}
            </span>
            <RelativeTime
              dateStr={page.updated_at}
              className="text-xs text-muted-foreground"
            />
          </button>
        ))}
      </div>
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">No pages yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first page to start writing. Pages can be nested to
          organize your workspace.
        </p>
        <Button>
          <Plus className="h-4 w-4" />
          Create first page
        </Button>
      </div>
    </div>
  ),
};
