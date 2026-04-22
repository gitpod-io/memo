import type { Meta, StoryObj } from "@storybook/react";
import { Maximize2, Table2 } from "lucide-react";
import { VIEW_TYPE_ICON } from "@/components/database/view-tabs";
import type { DatabaseViewType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Static mock of InlineDatabaseComponent for Storybook (no Supabase)
// ---------------------------------------------------------------------------

interface MockRow {
  id: string;
  title: string;
  icon: string | null;
  cells: string[];
}

interface MockView {
  id: string;
  name: string;
  type: DatabaseViewType;
}

interface InlineDatabaseMockProps {
  title: string;
  icon: string | null;
  columns: string[];
  rows: MockRow[];
  views: MockView[];
  activeViewId: string;
  deleted?: boolean;
  loading?: boolean;
}

function InlineDatabaseMock({
  title,
  icon,
  columns,
  rows,
  views,
  activeViewId,
  deleted,
  loading,
}: InlineDatabaseMockProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="mt-3 border border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="h-4 w-32 animate-pulse bg-muted" />
          <div className="h-3.5 w-3.5 animate-pulse bg-muted" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
              <div className="h-8 w-1/3 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Deleted / not found
  if (deleted) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-white/[0.06] px-3 py-3 text-sm text-muted-foreground">
        <Table2 className="h-4 w-4 shrink-0" />
        Database not found
      </div>
    );
  }

  return (
    <div className="mt-3 border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-accent hover:underline truncate cursor-pointer">
            {icon && <span className="mr-1">{icon}</span>}
            {title}
          </span>

          {views.length > 1 && (
            <div className="flex items-center gap-0.5 ml-2">
              {views.map((view) => {
                const Icon = VIEW_TYPE_ICON[view.type];
                return (
                  <button
                    key={view.id}
                    className={`flex items-center gap-1 px-1.5 py-0.5 text-xs ${
                      view.id === activeViewId
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={view.name}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open full database"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Compact table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-muted p-2 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground border-b border-white/[0.06]">
                Title
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="bg-muted p-2 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground border-b border-white/[0.06]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-2 py-6 text-center text-xs text-muted-foreground"
                >
                  No rows yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-white/[0.02] border-b border-white/[0.06]"
                >
                  <td className="p-2 text-sm truncate max-w-[200px]">
                    {row.icon && <span className="mr-1">{row.icon}</span>}
                    {row.title}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      className="p-2 text-sm text-muted-foreground truncate max-w-[150px]"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof InlineDatabaseMock> = {
  title: "Editor/InlineDatabase",
  component: InlineDatabaseMock,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
        <p className="text-sm mb-2">
          Some editor content above the inline database block.
        </p>
        <Story />
        <p className="text-sm mt-2">
          More editor content below the inline database block.
        </p>
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof InlineDatabaseMock>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const sampleViews: MockView[] = [
  { id: "v1", name: "Table view", type: "table" },
  { id: "v2", name: "Board view", type: "board" },
];

const sampleRows: MockRow[] = [
  { id: "r1", title: "Design system audit", icon: "🎨", cells: ["In Progress", "High", "Apr 15, 2026"] },
  { id: "r2", title: "API migration", icon: null, cells: ["Done", "Medium", "Apr 10, 2026"] },
  { id: "r3", title: "Performance testing", icon: "⚡", cells: ["Not Started", "High", "Apr 20, 2026"] },
  { id: "r4", title: "Documentation update", icon: "📝", cells: ["In Progress", "Low", "Apr 18, 2026"] },
  { id: "r5", title: "Security review", icon: "🔒", cells: ["Not Started", "High", "Apr 25, 2026"] },
];

export const Default: Story = {
  args: {
    title: "Project Tasks",
    icon: "📋",
    columns: ["Status", "Priority", "Due Date"],
    rows: sampleRows,
    views: sampleViews,
    activeViewId: "v1",
  },
};

export const SingleView: Story = {
  args: {
    title: "Bug Tracker",
    icon: "🐛",
    columns: ["Severity", "Assignee"],
    rows: [
      { id: "r1", title: "Login timeout", icon: null, cells: ["Critical", "Alice"] },
      { id: "r2", title: "CSS overflow", icon: null, cells: ["Minor", "Bob"] },
    ],
    views: [{ id: "v1", name: "Table view", type: "table" as const }],
    activeViewId: "v1",
  },
};

export const EmptyRows: Story = {
  args: {
    title: "New Database",
    icon: null,
    columns: ["Status", "Priority"],
    rows: [],
    views: [{ id: "v1", name: "Default view", type: "table" as const }],
    activeViewId: "v1",
  },
};

export const Deleted: Story = {
  args: {
    title: "",
    icon: null,
    columns: [],
    rows: [],
    views: [],
    activeViewId: "",
    deleted: true,
  },
};

export const Loading: Story = {
  args: {
    title: "",
    icon: null,
    columns: [],
    rows: [],
    views: [],
    activeViewId: "",
    loading: true,
  },
};

export const WithDatabaseIcon: Story = {
  args: {
    title: "Sprint Backlog",
    icon: "🗂️",
    columns: ["Points", "Sprint", "Owner"],
    rows: [
      { id: "r1", title: "User auth flow", icon: "🔐", cells: ["5", "Sprint 12", "Charlie"] },
      { id: "r2", title: "Dashboard widgets", icon: "📊", cells: ["8", "Sprint 12", "Dana"] },
      { id: "r3", title: "Email notifications", icon: "📧", cells: ["3", "Sprint 13", "Eve"] },
    ],
    views: [
      { id: "v1", name: "Table", type: "table" as const },
      { id: "v2", name: "Board", type: "board" as const },
      { id: "v3", name: "List", type: "list" as const },
    ],
    activeViewId: "v1",
  },
};

export const MaxFiveRows: Story = {
  args: {
    title: "Team Directory",
    icon: "👥",
    columns: ["Role", "Department"],
    rows: [
      { id: "r1", title: "Alice Johnson", icon: null, cells: ["Engineer", "Platform"] },
      { id: "r2", title: "Bob Smith", icon: null, cells: ["Designer", "Product"] },
      { id: "r3", title: "Charlie Brown", icon: null, cells: ["PM", "Product"] },
      { id: "r4", title: "Dana White", icon: null, cells: ["Engineer", "Frontend"] },
      { id: "r5", title: "Eve Davis", icon: null, cells: ["QA", "Platform"] },
    ],
    views: [{ id: "v1", name: "All members", type: "table" as const }],
    activeViewId: "v1",
  },
};
