import type { Meta, StoryObj } from "@storybook/react";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// VersionHistoryPanel depends on fetch calls and Lexical editor state.
// These stories render the visual states with static data.

const meta: Meta = {
  title: "Components/VersionHistoryPanel",
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj;

const mockVersions = [
  { id: "v1", created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: "v2", created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: "v3", created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "v4", created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: "v5", created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

function VersionItem({
  createdAt,
  selected,
}: {
  createdAt: string;
  selected?: boolean;
}) {
  const date = new Date(createdAt);
  return (
    <button
      type="button"
      className={`w-full border-b border-overlay-border px-4 py-3 text-left transition-none hover:bg-overlay-hover ${
        selected ? "bg-overlay-active" : ""
      }`}
    >
      <div className="text-sm" suppressHydrationWarning>
        {formatRelative(date)}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
        {date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    </button>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const WithVersions: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b border-overlay-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Version history
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            5 versions
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {mockVersions.map((v) => (
            <VersionItem key={v.id} createdAt={v.created_at} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const VersionSelected: Story = {
  name: "Version Selected",
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b border-overlay-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Version history
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            5 versions
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {mockVersions.map((v, i) => (
            <VersionItem key={v.id} createdAt={v.created_at} selected={i === 1} />
          ))}
        </div>
        <div className="border-t border-overlay-border p-4">
          <Button className="w-full" size="sm">
            <RotateCcw className="h-4 w-4" />
            Restore this version
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Empty: Story = {
  name: "Empty State",
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b border-overlay-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Version history
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            0 versions
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No versions yet</p>
            <p className="text-xs text-muted-foreground">
              Versions are saved automatically as you edit
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Loading: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b border-overlay-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Version history
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Loading...
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-muted" />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
