import type { Meta, StoryObj } from "@storybook/react";
import { FileText, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// TrashSection depends on next/navigation and Supabase.
// These stories render the visual appearance with static data.

const meta: Meta = {
  title: "Sidebar/TrashSection",
};

export { meta as default };

type Story = StoryObj;

const mockTrashedPages = [
  { id: "t1", icon: "📝", title: "Old Meeting Notes", deletedAt: "2026-04-20T10:00:00Z" },
  { id: "t2", icon: null, title: "Draft Proposal", deletedAt: "2026-04-19T15:30:00Z" },
  { id: "t3", icon: "🗂️", title: "Archive", deletedAt: "2026-04-18T09:00:00Z" },
];

function TrashItem({
  icon,
  title,
}: {
  icon: string | null;
  title: string;
}) {
  return (
    <div className="group flex items-center gap-2 px-2 py-0.5 text-sm text-muted-foreground hover:bg-white/[0.04]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <span className="flex-1 truncate text-left opacity-60">{title}</span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          aria-label="Restore page"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5 text-destructive"
          aria-label="Permanently delete page"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export const Collapsed: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <button className="flex items-center gap-2 px-2 py-0.5 text-xs tracking-widest uppercase text-white/30 hover:text-white/50">
          <Trash2 className="h-3 w-3" />
          <span className="flex-1 text-left">Trash</span>
          <span className="text-[10px] tabular-nums">3</span>
        </button>
      </div>
    </div>
  ),
};

export const Expanded: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <button className="flex items-center gap-2 px-2 py-0.5 text-xs tracking-widest uppercase text-white/30 hover:text-white/50">
          <Trash2 className="h-3 w-3" />
          <span className="flex-1 text-left">Trash</span>
          <span className="text-[10px] tabular-nums">3</span>
        </button>
        <div className="flex flex-col gap-0.5">
          {mockTrashedPages.map((page) => (
            <TrashItem key={page.id} icon={page.icon} title={page.title} />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="mx-2 mt-1 justify-start text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Empty trash
          </Button>
        </div>
      </div>
    </div>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <div className="flex flex-col gap-0.5">
        <button className="flex items-center gap-2 px-2 py-0.5 text-xs tracking-widest uppercase text-white/30 hover:text-white/50">
          <Trash2 className="h-3 w-3" />
          <span className="flex-1 text-left">Trash</span>
          <span className="text-[10px] tabular-nums">1</span>
        </button>
        <div className="flex flex-col gap-0.5">
          <TrashItem icon="📝" title="Old Meeting Notes" />
          <Button
            variant="ghost"
            size="sm"
            className="mx-2 mt-1 justify-start text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Empty trash
          </Button>
        </div>
      </div>
    </div>
  ),
};

export const Empty: Story = {
  name: "Empty (hidden)",
  render: () => (
    <div className="w-56 bg-muted p-2">
      <p className="px-2 text-xs text-muted-foreground">
        (Trash section is hidden when empty)
      </p>
    </div>
  ),
};
