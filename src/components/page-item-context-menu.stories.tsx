import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { FileText, Table2 } from "lucide-react";
import { PageItemContextMenu } from "@/components/page-item-context-menu";
import { RelativeTime } from "@/components/relative-time";

const meta: Meta<typeof PageItemContextMenu> = {
  title: "Components/PageItemContextMenu",
  component: PageItemContextMenu,
  parameters: {
    layout: "centered",
  },
  args: {
    pageId: "p1",
    pageTitle: "Getting Started",
    pageIcon: "🚀",
    isDatabase: false,
    isFavorited: false,
    favoriteId: undefined,
    workspaceSlug: "my-workspace",
    onOpen: fn(),
    onDuplicate: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof PageItemContextMenu>;

function PageItemContent({
  icon,
  title,
  isDatabase,
  childCount,
  timeStr,
}: {
  icon: string | null;
  title: string;
  isDatabase: boolean;
  childCount: number;
  timeStr: string;
}) {
  return (
    <button className="flex w-[500px] items-center gap-2 px-3 py-2 text-left text-sm hover:bg-overlay-hover focus-visible:bg-overlay-active focus-visible:outline-none">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : isDatabase ? (
          <Table2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="flex-1 truncate">{title || "Untitled"}</span>
      {isDatabase ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          Database
        </span>
      ) : childCount > 0 ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {childCount} sub-page{childCount !== 1 ? "s" : ""}
        </span>
      ) : null}
      <RelativeTime
        dateStr={timeStr}
        className="shrink-0 text-xs text-muted-foreground"
      />
    </button>
  );
}

/** Right-click the page item to see the context menu. */
export const Default: Story = {
  render: (args) => (
    <div className="p-8">
      <p className="mb-4 text-sm text-muted-foreground">
        Right-click the page item below to open the context menu.
      </p>
      <PageItemContextMenu {...args}>
        <PageItemContent
          icon="🚀"
          title="Getting Started"
          isDatabase={false}
          childCount={3}
          timeStr={new Date(Date.now() - 2 * 3_600_000).toISOString()}
        />
      </PageItemContextMenu>
    </div>
  ),
};

/** Context menu for a favorited page shows "Remove from favorites". */
export const Favorited: Story = {
  args: {
    isFavorited: true,
    favoriteId: "fav-1",
  },
  render: (args) => (
    <div className="p-8">
      <p className="mb-4 text-sm text-muted-foreground">
        Right-click to see &quot;Remove from favorites&quot; option.
      </p>
      <PageItemContextMenu {...args}>
        <PageItemContent
          icon="🚀"
          title="Getting Started"
          isDatabase={false}
          childCount={3}
          timeStr={new Date(Date.now() - 2 * 3_600_000).toISOString()}
        />
      </PageItemContextMenu>
    </div>
  ),
};

/** Context menu for a database page. */
export const DatabasePage: Story = {
  args: {
    pageId: "p7",
    pageTitle: "Bug Tracker",
    pageIcon: null,
    isDatabase: true,
  },
  render: (args) => (
    <div className="p-8">
      <p className="mb-4 text-sm text-muted-foreground">
        Right-click the database item below.
      </p>
      <PageItemContextMenu {...args}>
        <PageItemContent
          icon={null}
          title="Bug Tracker"
          isDatabase={true}
          childCount={0}
          timeStr={new Date(Date.now() - 1 * 3_600_000).toISOString()}
        />
      </PageItemContextMenu>
    </div>
  ),
};

/** Context menu for an untitled page. */
export const UntitledPage: Story = {
  args: {
    pageId: "p4",
    pageTitle: "",
    pageIcon: null,
    isDatabase: false,
  },
  render: (args) => (
    <div className="p-8">
      <p className="mb-4 text-sm text-muted-foreground">
        Right-click the untitled page item below.
      </p>
      <PageItemContextMenu {...args}>
        <PageItemContent
          icon={null}
          title=""
          isDatabase={false}
          childCount={0}
          timeStr={new Date(Date.now() - 5 * 86_400_000).toISOString()}
        />
      </PageItemContextMenu>
    </div>
  ),
};
