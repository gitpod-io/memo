import type { Meta, StoryObj } from "@storybook/react";
import {
  Check,
  ChevronsUpDown,
  FileText,
  MessageSquarePlus,
  Plus,
  Search,
  StarOff,
  Table2,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// AppSidebar composes WorkspaceSwitcher, PageSearch, FavoritesSection,
// PageTree, TrashSection, FeedbackForm, and UserMenu — all of which
// depend on next/navigation and Supabase. These stories render the
// full sidebar layout with static data.

const meta: Meta = {
  title: "Sidebar/AppSidebar",
};

export { meta as default };

type Story = StoryObj;

// --- Static sub-sections used to compose the sidebar ---

function WorkspaceSwitcherStatic() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 px-2"
            size="sm"
            aria-label="Switch workspace"
          />
        }
      >
        <span className="truncate text-sm font-medium">My Workspace</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
        <p className="px-1.5 py-1 text-xs tracking-widest uppercase text-label-faint">
          Workspaces
        </p>
        <DropdownMenuItem>
          <span className="flex-1 truncate">Personal</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span className="flex-1 truncate">My Workspace</span>
          <Check className="h-4 w-4 shrink-0 text-accent" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="h-4 w-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchStatic() {
  return (
    <div className="relative px-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search… ⌘K"
          readOnly
          className="h-7 border-overlay-border bg-transparent pl-7 pr-7 text-sm placeholder:text-muted-foreground"
          aria-label="Search pages"
        />
      </div>
    </div>
  );
}

function FavoritesStatic() {
  const favorites = [
    { id: "f1", icon: "📝", title: "Meeting Notes", isDatabase: false },
    { id: "f2", icon: null, title: "Bug Tracker", isDatabase: true },
  ];

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 text-xs tracking-widest uppercase text-label-faint">
        Favorites
      </p>
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="group flex items-center gap-2 px-2 py-0.5 text-sm text-muted-foreground hover:bg-overlay-hover"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {fav.icon ? (
              <span className="text-sm">{fav.icon}</span>
            ) : fav.isDatabase ? (
              <Table2 className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </span>
          <span className="flex-1 truncate text-left">{fav.title}</span>
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
            aria-label="Remove from favorites"
          >
            <StarOff className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PageTreeStatic({
  pages,
  selectedId,
}: {
  pages: { id: string; icon: string | null; title: string; isDatabase: boolean }[];
  selectedId?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
      <p className="px-2 text-xs tracking-widest uppercase text-label-faint">
        Pages
      </p>
      <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`group flex items-center gap-2 px-2 py-0.5 text-sm ${
              page.id === selectedId
                ? "bg-overlay-active font-medium text-label-subtle"
                : "text-muted-foreground hover:bg-overlay-hover"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {page.icon ? (
                <span className="text-sm">{page.icon}</span>
              ) : page.isDatabase ? (
                <Table2 className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </span>
            <span className="flex-1 truncate text-left">
              {page.title || "Untitled"}
            </span>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        className="mt-1 w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        New Page
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
      >
        <Table2 className="h-4 w-4" />
        New Database
      </Button>
    </div>
  );
}

function TrashStatic() {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        className="flex items-center gap-2 px-2 py-0.5 text-xs tracking-widest uppercase text-label-faint hover:text-label-muted"
        aria-expanded={false}
      >
        <Trash2 className="h-3 w-3" />
        <span className="flex-1 text-left">Trash</span>
        <span className="text-xs tabular-nums">2</span>
      </button>
    </div>
  );
}

function FeedbackStatic() {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 px-2 text-muted-foreground"
      size="sm"
    >
      <MessageSquarePlus className="h-4 w-4" />
      Feedback
    </Button>
  );
}

function UserMenuStatic() {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 px-2"
      size="sm"
    >
      <User className="h-4 w-4 shrink-0" />
      <span className="truncate text-sm">Jane Doe</span>
    </Button>
  );
}

// --- Composed sidebar ---

const defaultPages = [
  { id: "p1", icon: "📝", title: "Meeting Notes", isDatabase: false },
  { id: "p2", icon: null, title: "Project Roadmap", isDatabase: false },
  { id: "p3", icon: null, title: "Bug Tracker", isDatabase: true },
  { id: "p4", icon: "🎨", title: "Design System", isDatabase: false },
  { id: "p5", icon: null, title: "Sprint Retro", isDatabase: false },
];

function FullSidebar({
  selectedPageId,
  style,
}: {
  selectedPageId?: string;
  style?: React.CSSProperties;
}) {
  return (
    <aside
      className="h-full w-60 shrink-0 border-r border-overlay-border bg-muted"
      style={style}
    >
      <div className="flex h-full flex-col gap-2 p-2">
        <WorkspaceSwitcherStatic />
        <Separator className="bg-overlay-border" />
        <SearchStatic />
        <Separator className="bg-overlay-border" />
        <FavoritesStatic />
        <PageTreeStatic pages={defaultPages} selectedId={selectedPageId} />
        <TrashStatic />
        <Separator className="bg-overlay-border" />
        <FeedbackStatic />
        <UserMenuStatic />
      </div>
    </aside>
  );
}

export const Default: Story = {
  name: "Default (expanded)",
  render: () => (
    <div style={{ height: 600 }}>
      <FullSidebar selectedPageId="p2" />
    </div>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <div style={{ height: 600 }}>
      <aside
        className="h-full w-60 shrink-0 border-r border-overlay-border bg-muted transition-[width,opacity] duration-200 ease-out"
        style={{ width: 0, opacity: 0, overflow: "hidden" }}
      >
        <div className="flex h-full flex-col gap-2 p-2">
          <WorkspaceSwitcherStatic />
          <Separator className="bg-overlay-border" />
          <SearchStatic />
        </div>
      </aside>
    </div>
  ),
};

export const WithWorkspaceSwitcherOpen: Story = {
  name: "With workspace switcher open",
  render: () => (
    <div style={{ height: 600 }}>
      <aside className="h-full w-60 shrink-0 border-r border-overlay-border bg-muted">
        <div className="flex h-full flex-col gap-2 p-2">
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-between gap-2 px-2"
                  size="sm"
                  aria-label="Switch workspace"
                />
              }
            >
              <span className="truncate text-sm font-medium">
                My Workspace
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
              <p className="px-1.5 py-1 text-xs tracking-widest uppercase text-label-faint">
                Workspaces
              </p>
              <DropdownMenuItem>
                <span className="flex-1 truncate">Personal</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span className="flex-1 truncate">My Workspace</span>
                <Check className="h-4 w-4 shrink-0 text-accent" />
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span className="flex-1 truncate">Team Alpha</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Plus className="h-4 w-4" />
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator className="bg-overlay-border" />
          <SearchStatic />
          <Separator className="bg-overlay-border" />
          <FavoritesStatic />
          <PageTreeStatic pages={defaultPages} selectedId="p2" />
          <TrashStatic />
          <Separator className="bg-overlay-border" />
          <FeedbackStatic />
          <UserMenuStatic />
        </div>
      </aside>
    </div>
  ),
};

export const Mobile: Story = {
  name: "Mobile (sheet variant)",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: () => (
    <div
      className="relative bg-background"
      style={{ width: 320, height: 600, overflow: "hidden" }}
    >
      {/* Simulated sheet overlay */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-y-0 left-0 w-60 bg-muted p-0 shadow-lg">
        <div className="flex h-full flex-col gap-2 p-2">
          <WorkspaceSwitcherStatic />
          <Separator className="bg-overlay-border" />
          <SearchStatic />
          <Separator className="bg-overlay-border" />
          <FavoritesStatic />
          <PageTreeStatic pages={defaultPages} selectedId="p1" />
          <TrashStatic />
          <Separator className="bg-overlay-border" />
          <FeedbackStatic />
          <UserMenuStatic />
        </div>
      </div>
    </div>
  ),
};
