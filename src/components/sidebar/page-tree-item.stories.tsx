import type { Meta, StoryObj } from "@storybook/react";
import { PageTreeItem, type PageTreeItemProps } from "./page-tree-item";
import type { SidebarPage } from "@/lib/types";
import type { TreeNode } from "@/lib/page-tree";

const meta: Meta<PageTreeItemProps> = {
  title: "Sidebar/PageTreeItem",
  component: PageTreeItem,
};

export { meta as default };

type Story = StoryObj<PageTreeItemProps>;

const now = new Date().toISOString();

function makePage(overrides: Partial<SidebarPage> = {}): SidebarPage {
  return {
    id: "page-1",
    workspace_id: "ws-1",
    parent_id: null,
    title: "Meeting Notes",
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

const pages: SidebarPage[] = [
  makePage({ id: "page-1", title: "Meeting Notes", position: 0 }),
  makePage({ id: "page-2", title: "Project Roadmap", position: 1 }),
  makePage({ id: "page-child-1", title: "Q1 Goals", parent_id: "page-1", position: 0 }),
];

const baseProps: PageTreeItemProps = {
  node: makeNode({ id: "page-1", title: "Meeting Notes" }),
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
  favoriteMap: new Map(),
  onToggleFavorite: noop,
};

export const Default: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem {...baseProps} />
      </div>
    </div>
  ),
};

export const Selected: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem {...baseProps} selectedPageId="page-1" />
      </div>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          node={makeNode({ id: "page-1", title: "Meeting Notes", icon: "📝" })}
        />
      </div>
    </div>
  ),
};

export const DatabasePage: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          node={makeNode({ id: "page-1", title: "Bug Tracker", is_database: true })}
        />
      </div>
    </div>
  ),
};

export const Untitled: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          node={makeNode({ id: "page-1", title: "" })}
        />
      </div>
    </div>
  ),
};

export const WithChildren: Story = {
  name: "Expanded with children",
  render: () => {
    const childNode = makeNode({
      id: "page-child-1",
      title: "Q1 Goals",
      parent_id: "page-1",
    });
    const parentNode = makeNode(
      { id: "page-1", title: "Meeting Notes" },
      [childNode],
    );
    return (
      <div className="w-56 bg-muted p-2">
        <div role="tree" aria-label="Page tree">
          <PageTreeItem
            {...baseProps}
            node={parentNode}
            expanded={new Set(["page-1"])}
          />
        </div>
      </div>
    );
  },
};

export const CollapsedWithChildren: Story = {
  render: () => {
    const childNode = makeNode({
      id: "page-child-1",
      title: "Q1 Goals",
      parent_id: "page-1",
    });
    const parentNode = makeNode(
      { id: "page-1", title: "Meeting Notes" },
      [childNode],
    );
    return (
      <div className="w-56 bg-muted p-2">
        <div role="tree" aria-label="Page tree">
          <PageTreeItem
            {...baseProps}
            node={parentNode}
            expanded={new Set()}
          />
        </div>
      </div>
    );
  },
};

export const Dragged: Story = {
  name: "Being dragged",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem {...baseProps} draggedId="page-1" />
      </div>
    </div>
  ),
};

export const DropTargetBefore: Story = {
  name: "Drop target (before)",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          dropTarget={{ id: "page-1", position: "before" }}
        />
      </div>
    </div>
  ),
};

export const DropTargetInside: Story = {
  name: "Drop target (inside)",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          dropTarget={{ id: "page-1", position: "inside" }}
        />
      </div>
    </div>
  ),
};

export const Favorited: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          favoriteMap={new Map([["page-1", "fav-1"]])}
        />
      </div>
    </div>
  ),
};

export const Nested: Story = {
  name: "Nested at depth 2",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div role="tree" aria-label="Page tree">
        <PageTreeItem
          {...baseProps}
          node={makeNode({
            id: "page-child-1",
            title: "Q1 Goals",
            parent_id: "page-1",
          })}
          depth={2}
        />
      </div>
    </div>
  ),
};
