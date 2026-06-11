import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Download,
  FileText,
  Maximize2,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  Table2,
  Upload,
  Users,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Presentational wrapper for stories — the real CommandPalette depends on
// routing and Supabase, so stories use the raw Command primitives.

const MOCK_RECENT = [
  { id: "r1", title: "Sprint Planning", icon: "📋", isDatabase: false, parent: null },
  { id: "r2", title: "API Design", icon: null, isDatabase: false, parent: "Engineering" },
  { id: "r3", title: "Team Directory", icon: null, isDatabase: true, parent: null },
];

const MOCK_PAGES = [
  { id: "p1", title: "Getting Started", icon: "🚀", isDatabase: false, parent: null },
  { id: "p2", title: "Engineering", icon: "⚙️", isDatabase: false, parent: null },
  { id: "p3", title: "API Design", icon: null, isDatabase: false, parent: "Engineering" },
  { id: "p4", title: "Backend Services", icon: null, isDatabase: false, parent: "Engineering → API Design" },
  { id: "p5", title: "Team Directory", icon: null, isDatabase: true, parent: null },
  { id: "p6", title: "Q2 OKRs", icon: "🎯", isDatabase: false, parent: null },
  { id: "p7", title: "Meeting Notes", icon: "📝", isDatabase: false, parent: null },
  { id: "p8", title: "Sprint Planning", icon: "📋", isDatabase: false, parent: null },
];

interface MockAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const MOCK_ACTIONS: MockAction[] = [
  { id: "new-page", label: "New Page", icon: <Plus className="h-4 w-4 text-muted-foreground" />, shortcut: "⌘N" },
  { id: "new-database", label: "New Database", icon: <Table2 className="h-4 w-4 text-muted-foreground" /> },
  { id: "export-markdown", label: "Export as Markdown", icon: <Download className="h-4 w-4 text-muted-foreground" />, shortcut: "⌘⇧E" },
  { id: "import-markdown", label: "Import Markdown", icon: <Upload className="h-4 w-4 text-muted-foreground" /> },
  { id: "workspace-settings", label: "Workspace Settings", icon: <Settings className="h-4 w-4 text-muted-foreground" /> },
  { id: "members", label: "Members", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
  { id: "toggle-theme", label: "Switch to Light Mode", icon: <Sun className="h-4 w-4 text-muted-foreground" /> },
  { id: "toggle-sidebar", label: "Toggle Sidebar", icon: <PanelLeft className="h-4 w-4 text-muted-foreground" />, shortcut: "⌘\\" },
  { id: "toggle-focus-mode", label: "Toggle Focus Mode", icon: <Maximize2 className="h-4 w-4 text-muted-foreground" />, shortcut: "⌘⇧F" },
];

/** Actions without page-context-dependent items (e.g. Export). */
const MOCK_ACTIONS_NO_PAGE = MOCK_ACTIONS.filter((a) => a.id !== "export-markdown");

function PageIcon({ icon, isDatabase }: { icon: string | null; isDatabase: boolean }) {
  if (icon) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-sm">
        {icon}
      </span>
    );
  }
  if (isDatabase) {
    return <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function ParentBreadcrumb({ parent }: { parent: string | null }) {
  if (!parent) return null;
  return (
    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground max-w-[200px]">
      {parent}
    </span>
  );
}

function ActionItems({ actions }: { actions: MockAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <CommandItem key={action.id} value={action.label}>
          {action.icon}
          <span className="flex-1 truncate">{action.label}</span>
          {action.shortcut && (
            <CommandShortcut>{action.shortcut}</CommandShortcut>
          )}
        </CommandItem>
      ))}
    </>
  );
}

function PaletteContent({
  showRecent = true,
  showActions = true,
  actions = MOCK_ACTIONS,
  initialQuery = "",
  placeholder = "Search pages… ⌘P",
}: {
  showRecent?: boolean;
  showActions?: boolean;
  actions?: MockAction[];
  initialQuery?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const hasQuery = query.trim().length > 0;

  return (
    <Command className="rounded-none bg-popover" shouldFilter={hasQuery}>
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {!hasQuery && showActions && (
          <CommandGroup heading="Quick Actions">
            <ActionItems actions={actions} />
          </CommandGroup>
        )}

        {!hasQuery && showRecent && (
          <CommandGroup heading="Recent">
            {MOCK_RECENT.map((item) => (
              <CommandItem key={`recent-${item.id}`} value={item.title}>
                <PageIcon icon={item.icon} isDatabase={item.isDatabase} />
                <span className="flex-1 truncate">{item.title}</span>
                <ParentBreadcrumb parent={item.parent} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && (
          <>
            <CommandGroup heading="Quick Actions">
              <ActionItems actions={actions} />
            </CommandGroup>
            <CommandGroup heading="Pages">
              {MOCK_PAGES.map((page) => (
                <CommandItem
                  key={page.id}
                  value={`${page.title} ${page.parent ?? ""}`}
                >
                  <PageIcon icon={page.icon} isDatabase={page.isDatabase} />
                  <span className="flex-1 truncate">{page.title}</span>
                  <ParentBreadcrumb parent={page.parent} />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!hasQuery && (
          <CommandGroup heading="All Pages">
            {MOCK_PAGES.map((page) => (
              <CommandItem
                key={page.id}
                value={`${page.title} ${page.parent ?? ""}`}
              >
                <PageIcon icon={page.icon} isDatabase={page.isDatabase} />
                <span className="flex-1 truncate">{page.title}</span>
                <ParentBreadcrumb parent={page.parent} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

const meta: Meta = {
  title: "Components/CommandPalette",
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj;

/** Default state with quick actions, recent pages, and all pages visible. */
export const Default: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent />
    </div>
  ),
};

/** With a search query filtering both actions and pages. */
export const WithQuery: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent initialQuery="export" />
    </div>
  ),
};

/** Without recent visits — shows quick actions and all pages. */
export const NoRecentVisits: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent showRecent={false} />
    </div>
  ),
};

/** Quick actions when not on a page — Export is hidden. */
export const ActionsNoPageContext: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent actions={MOCK_ACTIONS_NO_PAGE} />
    </div>
  ),
};

/** Quick actions with light theme toggle variant. */
export const ActionsLightTheme: Story = {
  render: () => {
    const lightActions = MOCK_ACTIONS.map((a) =>
      a.id === "toggle-theme"
        ? { ...a, label: "Switch to Dark Mode", icon: <Moon className="h-4 w-4 text-muted-foreground" /> }
        : a,
    );
    return (
      <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
        <PaletteContent actions={lightActions} />
      </div>
    );
  },
};

/** Inside a dialog, matching the real usage. */
export const InDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          Open Command Palette (⌘P)
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogHeader className="sr-only">
            <DialogTitle>Command palette</DialogTitle>
            <DialogDescription>
              Search for a page or run a quick action
            </DialogDescription>
          </DialogHeader>
          <DialogContent
            className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-lg"
            showCloseButton={false}
          >
            <PaletteContent />
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

/** Empty state when no pages or actions match the query. */
export const EmptyState: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <Command className="rounded-none bg-popover">
        <CommandInput placeholder="Search pages… ⌘P" value="zzzznonexistent" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  ),
};
