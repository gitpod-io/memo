import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Table2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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

function PaletteContent({
  showRecent = true,
  initialQuery = "",
}: {
  showRecent?: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const hasQuery = query.trim().length > 0;

  return (
    <Command className="rounded-none bg-popover" shouldFilter={hasQuery}>
      <CommandInput
        placeholder="Search pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>

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

/** Default state with recent pages and all pages visible. */
export const Default: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent />
    </div>
  ),
};

/** With a search query filtering results. */
export const WithQuery: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent initialQuery="API" />
    </div>
  ),
};

/** Without recent visits — shows all pages directly. */
export const NoRecentVisits: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <PaletteContent showRecent={false} />
    </div>
  ),
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
              Search for a page to navigate to
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

/** Empty state when no pages match the query. */
export const EmptyState: Story = {
  render: () => (
    <div className="w-[512px] border border-overlay-border bg-popover shadow-md">
      <Command className="rounded-none bg-popover">
        <CommandInput placeholder="Search pages…" value="zzzznonexistent" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  ),
};
