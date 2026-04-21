import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: "p2",
    title: "API Reference",
    icon: null,
    created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: "p3",
    title: "Design System",
    icon: "🎨",
    created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: "p4",
    title: "",
    icon: null,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: "p5",
    title: "Architecture Overview",
    icon: "🏗️",
    created_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3_600_000).toISOString(),
  },
  {
    id: "p6",
    title: "Meeting Notes",
    icon: "📝",
    created_at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
];

const mockRecentVisits = [
  {
    page_id: "p3",
    title: "Design System",
    icon: "🎨",
    visited_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    page_id: "p1",
    title: "Getting Started",
    icon: "🚀",
    visited_at: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
  {
    page_id: "p2",
    title: "API Reference",
    icon: null,
    visited_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
];

function PageItem({
  icon,
  title,
  timeStr,
}: {
  icon: string | null;
  title: string;
  timeStr: string;
}) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.04]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="flex-1 truncate">{title || "Untitled"}</span>
      <RelativeTime
        dateStr={timeStr}
        className="text-xs text-muted-foreground"
      />
    </button>
  );
}

function SortFilterBar() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter pages…"
          className="pl-8"
          aria-label="Filter pages by title"
        />
      </div>
      <Select defaultValue="updated_desc">
        <SelectTrigger
          size="sm"
          className="w-auto shrink-0"
          aria-label="Sort pages"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updated_desc">Last modified</SelectItem>
          <SelectItem value="title_asc">Title A-Z</SelectItem>
          <SelectItem value="title_desc">Title Z-A</SelectItem>
          <SelectItem value="created_desc">
            Date created (newest)
          </SelectItem>
          <SelectItem value="created_asc">
            Date created (oldest)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

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
      <div className="mt-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-white/30">
          All Pages
        </h2>
        <SortFilterBar />
        <div className="flex flex-col gap-0.5">
          {mockPages.map((page) => (
            <PageItem
              key={page.id}
              icon={page.icon}
              title={page.title}
              timeStr={page.updated_at}
            />
          ))}
        </div>
      </div>
    </div>
  ),
};

export const WithRecentVisits: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Workspace</h1>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>
      <div className="mt-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-white/30">
          Recently Visited
        </h2>
        <div className="flex flex-col gap-0.5">
          {mockRecentVisits.map((visit) => (
            <PageItem
              key={visit.page_id}
              icon={visit.icon}
              title={visit.title}
              timeStr={visit.visited_at}
            />
          ))}
        </div>
      </div>
      <div className="mt-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-white/30">
          All Pages
        </h2>
        <SortFilterBar />
        <div className="flex flex-col gap-0.5">
          {mockPages.map((page) => (
            <PageItem
              key={page.id}
              icon={page.icon}
              title={page.title}
              timeStr={page.updated_at}
            />
          ))}
        </div>
      </div>
    </div>
  ),
};

export const FilterNoResults: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Workspace</h1>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>
      <div className="mt-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-white/30">
          All Pages
        </h2>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter pages…"
              defaultValue="nonexistent"
              className="pl-8"
              aria-label="Filter pages by title"
            />
          </div>
          <Select defaultValue="updated_desc">
            <SelectTrigger
              size="sm"
              className="w-auto shrink-0"
              aria-label="Sort pages"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Last modified</SelectItem>
              <SelectItem value="title_asc">Title A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No pages match your filter
          </p>
        </div>
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
