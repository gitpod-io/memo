import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTreeItem } from "./page-tree-item";
import type { SidebarPage } from "@/lib/types";
import type { TreeNode } from "@/lib/page-tree";

// PageTree depends on next/navigation and Supabase for data fetching.
// These stories compose PageTreeItem (which is pure-presentational) to
// render realistic tree states with static data.

const meta: Meta = {
  title: "Sidebar/PageTree",
};

export { meta as default };

type Story = StoryObj;

const now = new Date().toISOString();

function makePage(overrides: Partial<SidebarPage> = {}): SidebarPage {
  return {
    id: "page-1",
    workspace_id: "ws-1",
    parent_id: null,
    title: "Untitled",
    icon: null,
    cover_url: null,
    is_database: false,
    position: 0,
    created_by: "user-1",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

function makeNode(
  pageOverrides: Partial<SidebarPage> = {},
  children: TreeNode[] = [],
): TreeNode {
  return { page: makePage(pageOverrides), children };
}

const noop = () => {};
const noopAsync = () => Promise.resolve();

// --- Flat pages data ---

const flatPages: SidebarPage[] = [
  makePage({ id: "p1", title: "Meeting Notes", icon: "📝", position: 0 }),
  makePage({ id: "p2", title: "Project Roadmap", position: 1 }),
  makePage({ id: "p3", title: "Design System", icon: "🎨", position: 2 }),
  makePage({ id: "p4", title: "Sprint Retro", position: 3 }),
];

const flatTree: TreeNode[] = flatPages.map((p) => ({ page: p, children: [] }));

// --- Nested pages data (3 levels deep) ---

const nestedPages: SidebarPage[] = [
  makePage({ id: "n1", title: "Engineering", icon: "⚙️", position: 0 }),
  makePage({ id: "n1-1", title: "Backend", parent_id: "n1", position: 0 }),
  makePage({ id: "n1-1-1", title: "API Design", parent_id: "n1-1", position: 0 }),
  makePage({ id: "n1-1-2", title: "Database Schema", parent_id: "n1-1", position: 1 }),
  makePage({ id: "n1-2", title: "Frontend", parent_id: "n1", position: 1 }),
  makePage({ id: "n2", title: "Product", icon: "📦", position: 1 }),
  makePage({ id: "n2-1", title: "Roadmap Q1", parent_id: "n2", position: 0 }),
];

const nestedTree: TreeNode[] = [
  makeNode({ id: "n1", title: "Engineering", icon: "⚙️", position: 0 }, [
    makeNode({ id: "n1-1", title: "Backend", parent_id: "n1", position: 0 }, [
      makeNode({ id: "n1-1-1", title: "API Design", parent_id: "n1-1", position: 0 }),
      makeNode({ id: "n1-1-2", title: "Database Schema", parent_id: "n1-1", position: 1 }),
    ]),
    makeNode({ id: "n1-2", title: "Frontend", parent_id: "n1", position: 1 }),
  ]),
  makeNode({ id: "n2", title: "Product", icon: "📦", position: 1 }, [
    makeNode({ id: "n2-1", title: "Roadmap Q1", parent_id: "n2", position: 0 }),
  ]),
];

// --- Database pages data ---

const dbPages: SidebarPage[] = [
  makePage({ id: "d1", title: "Bug Tracker", is_database: true, position: 0 }),
  makePage({ id: "d2", title: "Meeting Notes", icon: "📝", position: 1 }),
  makePage({ id: "d3", title: "Task Board", is_database: true, position: 2 }),
];

const dbTree: TreeNode[] = dbPages.map((p) => ({ page: p, children: [] }));

// --- Many pages data (20+ items) ---

const manyPages: SidebarPage[] = Array.from({ length: 24 }, (_, i) =>
  makePage({
    id: `m${i}`,
    title: `Page ${i + 1}`,
    icon: i % 5 === 0 ? "📄" : null,
    position: i,
  }),
);

const manyTree: TreeNode[] = manyPages.map((p) => ({ page: p, children: [] }));

// Shared base props for PageTreeItem
function baseItemProps(pages: SidebarPage[]) {
  return {
    depth: 0,
    expanded: new Set<string>(),
    toggleExpand: noop,
    selectedPageId: undefined,
    onNavigate: noop,
    onPrefetch: noop,
    onCreate: noop,
    onDuplicate: noopAsync as unknown as (page: SidebarPage) => void,
    onDelete: noop,
    onMoveUp: noopAsync as unknown as (page: SidebarPage) => void,
    onMoveDown: noopAsync as unknown as (page: SidebarPage) => void,
    onNest: noopAsync as unknown as (page: SidebarPage) => void,
    onUnnest: noopAsync as unknown as (page: SidebarPage) => void,
    draggedId: null,
    dropTarget: null,
    onDragStart: noop,
    onDragOver: noop,
    onDragLeave: noop,
    onDrop: noop,
    onDragEnd: noop,
    pages,
    favoriteMap: new Map<string, string>(),
    onToggleFavorite: noop,
  };
}

function TreeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-2 text-xs tracking-widest uppercase text-label-faint">
          Pages
        </p>
        {children}
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
    </div>
  );
}

export const Default: Story = {
  name: "Default (flat pages)",
  render: () => {
    const props = baseItemProps(flatPages);
    return (
      <TreeShell>
        <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
          {flatTree.map((node) => (
            <PageTreeItem key={node.page.id} {...props} node={node} />
          ))}
        </div>
      </TreeShell>
    );
  },
};

export const Nested: Story = {
  name: "Nested (3 levels deep)",
  render: () => {
    const props = baseItemProps(nestedPages);
    const expandedSet = new Set(["n1", "n1-1", "n2"]);
    return (
      <TreeShell>
        <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
          {nestedTree.map((node) => (
            <PageTreeItem
              key={node.page.id}
              {...props}
              node={node}
              expanded={expandedSet}
            />
          ))}
        </div>
      </TreeShell>
    );
  },
};

export const Empty: Story = {
  name: "Empty (no pages)",
  render: () => (
    <TreeShell>
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>No pages yet</span>
      </div>
    </TreeShell>
  ),
};

export const WithDatabasePages: Story = {
  name: "With database pages",
  render: () => {
    const props = baseItemProps(dbPages);
    return (
      <TreeShell>
        <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
          {dbTree.map((node) => (
            <PageTreeItem key={node.page.id} {...props} node={node} />
          ))}
        </div>
      </TreeShell>
    );
  },
};

export const WithActivePage: Story = {
  name: "With active page (highlighted)",
  render: () => {
    const props = baseItemProps(flatPages);
    return (
      <TreeShell>
        <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
          {flatTree.map((node) => (
            <PageTreeItem
              key={node.page.id}
              {...props}
              node={node}
              selectedPageId="p2"
            />
          ))}
        </div>
      </TreeShell>
    );
  },
};

export const ManyPages: Story = {
  name: "Many pages (24 items, scroll)",
  render: () => {
    const props = baseItemProps(manyPages);
    return (
      <div className="w-56 bg-muted p-2" style={{ maxHeight: 400 }}>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto" style={{ maxHeight: 360 }}>
          <p className="px-2 text-xs tracking-widest uppercase text-label-faint">
            Pages
          </p>
          <div className="flex flex-col gap-0.5" role="tree" aria-label="Page tree">
            {manyTree.map((node) => (
              <PageTreeItem key={node.page.id} {...props} node={node} />
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
      </div>
    );
  },
};
