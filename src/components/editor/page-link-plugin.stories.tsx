import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Search } from "lucide-react";

// The PageLinkPlugin handles INSERT_PAGE_LINK_COMMAND and renders a page
// search menu triggered by @-mention. It requires Lexical context and
// Supabase — stories show the static visual output of the page picker.

const meta: Meta = {
  title: "Editor/PageLinkPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

interface PageResult {
  id: string;
  title: string;
  icon: string | null;
}

function StaticPageLinkMenu({
  results,
  selectedIndex = 0,
  query = "",
}: {
  results: PageResult[];
  selectedIndex?: number;
  query?: string;
}) {
  return (
    <div className="mx-auto max-w-xs">
      <div className="w-64 rounded-sm border border-overlay-border bg-popover p-2 shadow-md">
        <div className="flex items-center gap-2 border-b border-overlay-border pb-2 mb-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            defaultValue={query}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {results.length > 0 ? (
          <div className="max-h-48 overflow-y-auto">
            {results.map((page, index) => (
              <button
                key={page.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                  selectedIndex === index
                    ? "bg-overlay-active text-foreground"
                    : "text-muted-foreground hover:bg-overlay-hover"
                }`}
              >
                <span className="text-base">
                  {page.icon ?? <FileText className="h-4 w-4" />}
                </span>
                <span className="truncate font-medium text-foreground">
                  {page.title || "Untitled"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No pages found
          </div>
        )}
      </div>
    </div>
  );
}

/** Page link picker with search results. */
export const WithResults: Story = {
  render: () => (
    <StaticPageLinkMenu
      results={[
        { id: "1", title: "Getting Started", icon: "📖" },
        { id: "2", title: "Architecture Overview", icon: "🏗️" },
        { id: "3", title: "Meeting Notes", icon: "📝" },
        { id: "4", title: "Product Roadmap", icon: "🗺️" },
      ]}
      selectedIndex={0}
    />
  ),
};

/** Filtered results — searching for a specific page. */
export const FilteredResults: Story = {
  render: () => (
    <StaticPageLinkMenu
      results={[{ id: "1", title: "Getting Started", icon: "📖" }]}
      selectedIndex={0}
      query="getting"
    />
  ),
};

/** Empty state — no pages match the search. */
export const EmptyResults: Story = {
  render: () => <StaticPageLinkMenu results={[]} query="nonexistent" />,
};

/** Rendered page link inline in text. */
export const InlinePageLink: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground leading-relaxed">
      <p>
        For more details, see{" "}
        <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-accent">
          <FileText className="h-3 w-3" />
          <span className="text-xs font-medium">Getting Started</span>
        </span>{" "}
        which covers the setup process.
      </p>
    </div>
  ),
};

/** Multiple page links in a paragraph. */
export const MultipleInlineLinks: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground leading-relaxed">
      <p>
        Review the{" "}
        <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-accent">
          <FileText className="h-3 w-3" />
          <span className="text-xs font-medium">Architecture Overview</span>
        </span>{" "}
        and{" "}
        <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-accent">
          <FileText className="h-3 w-3" />
          <span className="text-xs font-medium">Product Roadmap</span>
        </span>{" "}
        before the meeting.
      </p>
    </div>
  ),
};
