import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Search, Table2 } from "lucide-react";

// The DatabasePlugin handles INSERT_DATABASE_COMMAND and renders a database
// picker menu. It requires Lexical context and Supabase — stories show the
// static visual output of the database picker menu.

const meta: Meta = {
  title: "Editor/DatabasePlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

interface DatabaseResult {
  id: string;
  title: string;
  icon: string | null;
}

function StaticDatabaseMenu({
  results,
  selectedIndex = 0,
  query = "",
}: {
  results: DatabaseResult[];
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
            placeholder="Search databases…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {results.length > 0 ? (
          <div className="max-h-48 overflow-y-auto">
            {results.map((db, index) => (
              <button
                key={db.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                  selectedIndex === index
                    ? "bg-overlay-active text-foreground"
                    : "text-muted-foreground hover:bg-overlay-hover"
                }`}
              >
                <span className="text-base">{db.icon ?? "📊"}</span>
                <span className="truncate font-medium text-foreground">
                  {db.title}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No databases found
          </div>
        )}
        <div className="mt-1 border-t border-overlay-border pt-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Create new database</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Database picker with search results. */
export const WithResults: Story = {
  render: () => (
    <StaticDatabaseMenu
      results={[
        { id: "1", title: "Project Tasks", icon: "📋" },
        { id: "2", title: "Bug Tracker", icon: "🐛" },
        { id: "3", title: "Reading List", icon: "📚" },
      ]}
      selectedIndex={0}
    />
  ),
};

/** Database picker with search query filtering results. */
export const FilteredResults: Story = {
  render: () => (
    <StaticDatabaseMenu
      results={[{ id: "1", title: "Project Tasks", icon: "📋" }]}
      selectedIndex={0}
      query="project"
    />
  ),
};

/** Empty state — no databases match the search. */
export const EmptyResults: Story = {
  render: () => <StaticDatabaseMenu results={[]} query="nonexistent" />,
};

/** Embedded database node rendered in the editor. */
export const EmbeddedDatabaseNode: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <div className="my-4 rounded-sm border border-overlay-border bg-background p-4">
        <div className="flex items-center gap-2 mb-3">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Project Tasks
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 border-b border-overlay-border pb-1 text-xs text-muted-foreground">
            <span className="w-1/3">Title</span>
            <span className="w-1/4">Status</span>
            <span className="w-1/4">Priority</span>
          </div>
          {[
            { title: "Design homepage", status: "Done", priority: "High" },
            { title: "Add auth flow", status: "In Progress", priority: "High" },
            { title: "Write tests", status: "To Do", priority: "Medium" },
          ].map((row) => (
            <div
              key={row.title}
              className="flex items-center gap-2 py-1 text-sm text-foreground"
            >
              <span className="w-1/3 truncate">{row.title}</span>
              <span className="w-1/4 text-xs text-muted-foreground">
                {row.status}
              </span>
              <span className="w-1/4 text-xs text-muted-foreground">
                {row.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};
