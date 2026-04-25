import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Search, Table2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// PageSearch depends on next/navigation, Supabase, and SidebarContext.
// These stories render the visual appearance with static data.

const meta: Meta = {
  title: "Sidebar/PageSearch",
};

export { meta as default };

type Story = StoryObj;

const mockResults = [
  {
    id: "r1",
    icon: "📝",
    title: "Meeting Notes",
    isDatabase: false,
    snippet: "Weekly <<standup>> notes from the engineering team",
  },
  {
    id: "r2",
    icon: null,
    title: "Project Roadmap",
    isDatabase: false,
    snippet: "Q1 milestones and <<standup>> deliverables",
  },
  {
    id: "r3",
    icon: null,
    title: "Bug Tracker",
    isDatabase: true,
    snippet: "Track all <<standup>> blockers and issues",
  },
];

function renderSnippet(snippet: string) {
  const parts = snippet.split(/(<<|>>)/);
  const elements: React.ReactNode[] = [];
  let inHighlight = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "<<") {
      inHighlight = true;
      continue;
    }
    if (part === ">>") {
      inHighlight = false;
      continue;
    }
    if (part) {
      elements.push(
        inHighlight ? (
          <mark
            key={i}
            className="bg-accent/20 text-foreground rounded-none"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      );
    }
  }

  return elements;
}

function SearchShell({
  query,
  showClear,
  children,
}: {
  query: string;
  showClear: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative w-56 bg-muted p-2">
      <div className="relative px-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search… ⌘K"
            value={query}
            readOnly
            className="h-7 border-overlay-border bg-transparent pl-7 pr-7 text-sm placeholder:text-muted-foreground"
            aria-label="Search pages"
            role="combobox"
          />
          {showClear && (
            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export const Default: Story = {
  name: "Default (closed)",
  render: () => <SearchShell query="" showClear={false} />,
};

export const Open: Story = {
  name: "Open (empty input)",
  render: () => <SearchShell query="" showClear={false} />,
};

export const WithResults: Story = {
  render: () => (
    <SearchShell query="standup" showClear>
      <div
        role="listbox"
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto border border-overlay-border bg-muted rounded-sm shadow-md"
      >
        {mockResults.map((result, index) => (
          <button
            key={result.id}
            role="option"
            aria-selected={index === 0}
            className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-none ${
              index === 0
                ? "bg-overlay-active"
                : "hover:bg-overlay-hover"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              {result.icon ? (
                <span className="shrink-0 text-sm">{result.icon}</span>
              ) : result.isDatabase ? (
                <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{result.title}</span>
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground pl-6">
              {renderSnippet(result.snippet)}
            </span>
          </button>
        ))}
      </div>
    </SearchShell>
  ),
};

export const NoResults: Story = {
  render: () => (
    <SearchShell query="xyznonexistent" showClear>
      <div
        role="listbox"
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto border border-overlay-border bg-muted rounded-sm shadow-md"
      >
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          No pages match your search
        </div>
      </div>
    </SearchShell>
  ),
};

export const Loading: Story = {
  render: () => (
    <SearchShell query="loading" showClear>
      <div
        role="listbox"
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto border border-overlay-border bg-muted rounded-sm shadow-md"
      >
        <div className="flex flex-col">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 bg-overlay-active animate-pulse" />
                <div className="h-3.5 w-32 bg-overlay-active animate-pulse" />
              </div>
              <div className="h-3 w-48 bg-overlay-active animate-pulse ml-6" />
            </div>
          ))}
        </div>
      </div>
    </SearchShell>
  ),
};
