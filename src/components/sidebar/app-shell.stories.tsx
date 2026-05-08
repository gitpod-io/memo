import type { Meta, StoryObj } from "@storybook/react";
import {
  FileText,
  ChevronRight,
  Plus,
  Search,
  Settings,
  PanelLeft,
} from "lucide-react";

// AppShell wraps the app with SidebarProvider, AppSidebar, and main content
// area. It requires Supabase context — stories show the static visual layout
// of the shell with sidebar open and collapsed states.

const meta: Meta = {
  title: "Sidebar/AppShell",
  parameters: {
    layout: "fullscreen",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticSidebar({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-full w-0 flex-col border-r border-overlay-border bg-sidebar overflow-hidden" />
    );
  }

  return (
    <div className="flex h-full w-60 flex-col border-r border-overlay-border bg-sidebar">
      {/* Workspace switcher */}
      <div className="flex h-10 items-center gap-2 border-b border-overlay-border px-3">
        <span className="text-sm font-medium text-foreground">
          My Workspace
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>
      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-sm border border-overlay-border px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Search…</span>
        </div>
      </div>
      {/* New page button */}
      <div className="px-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-overlay-hover"
        >
          <Plus className="h-3 w-3" />
          New page
        </button>
      </div>
      {/* Page tree */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {["Getting Started", "Meeting Notes", "Project Tasks"].map(
            (page) => (
              <button
                key={page}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm text-foreground hover:bg-overlay-hover"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{page}</span>
              </button>
            ),
          )}
        </div>
      </div>
      {/* Settings */}
      <div className="border-t border-overlay-border px-3 py-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-overlay-hover"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>
    </div>
  );
}

/** Sidebar open — default desktop layout. */
export const SidebarOpen: Story = {
  render: () => (
    <div className="flex h-[500px] overflow-hidden bg-background">
      <StaticSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold text-foreground">Page Title</h1>
            <p className="mt-4 text-sm text-foreground">
              Main content area. The sidebar is open on the left.
            </p>
          </div>
        </main>
      </div>
    </div>
  ),
};

/** Sidebar collapsed — more space for content. */
export const SidebarCollapsed: Story = {
  render: () => (
    <div className="flex h-[500px] overflow-hidden bg-background">
      <StaticSidebar collapsed />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-overlay-hover"
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Page Title</h1>
            <p className="mt-4 text-sm text-foreground">
              Main content area with sidebar collapsed. Toggle button visible.
            </p>
          </div>
        </main>
      </div>
    </div>
  ),
};

/** Mobile layout — sidebar as overlay sheet. */
export const MobileLayout: Story = {
  render: () => (
    <div className="h-[500px] w-[375px] overflow-hidden bg-background">
      <header className="flex h-10 items-center gap-2 border-b border-overlay-border px-4">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-overlay-hover"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          My Workspace
        </span>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <h1 className="text-xl font-bold text-foreground">Page Title</h1>
        <p className="mt-4 text-sm text-foreground">
          Mobile layout with sidebar toggle in the header.
        </p>
      </main>
    </div>
  ),
};

/** Skip to content link — visible on focus for accessibility. */
export const SkipToContent: Story = {
  render: () => (
    <div className="flex h-[500px] overflow-hidden bg-background">
      <StaticSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="relative">
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-50 bg-background px-4 py-2 text-sm font-medium text-foreground ring-2 ring-ring"
          >
            Skip to content
          </a>
        </div>
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold text-foreground">Page Title</h1>
            <p className="mt-4 text-sm text-foreground">
              The &quot;Skip to content&quot; link is shown when focused via
              keyboard navigation.
            </p>
          </div>
        </main>
      </div>
    </div>
  ),
};
