import type { Meta, StoryObj } from "@storybook/react";
import { FileText, ArrowUpLeft } from "lucide-react";
import Link from "next/link";

// The actual PageBacklinks is a server component that queries Supabase.
// This story renders the same UI with static data for visual testing.

interface BacklinkItem {
  id: string;
  title: string;
  icon: string | null;
}

function PageBacklinksStory({ backlinks }: { backlinks: BacklinkItem[] }) {
  if (backlinks.length === 0) return null;

  return (
    <div className="mt-8 border-t border-white/[0.06] pt-4">
      <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-white/30 mb-3">
        <ArrowUpLeft className="h-3.5 w-3.5" />
        Backlinks
      </div>
      <div className="flex flex-col gap-1">
        {backlinks.map((backlink) => (
          <Link
            key={backlink.id}
            href={`/workspace/${backlink.id}`}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-none"
          >
            {backlink.icon ? (
              <span className="shrink-0 text-sm">{backlink.icon}</span>
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">
              {backlink.title || "Untitled"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof PageBacklinksStory> = {
  title: "Components/PageBacklinks",
  component: PageBacklinksStory,
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-6">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof PageBacklinksStory>;

export const SingleBacklink: Story = {
  args: {
    backlinks: [
      { id: "page-1", title: "Project Overview", icon: "📋" },
    ],
  },
};

export const MultipleBacklinks: Story = {
  args: {
    backlinks: [
      { id: "page-1", title: "Project Overview", icon: "📋" },
      { id: "page-2", title: "Meeting Notes", icon: "📝" },
      { id: "page-3", title: "Architecture Decisions", icon: null },
      { id: "page-4", title: "Sprint Planning", icon: "🏃" },
    ],
  },
};

export const BacklinksWithoutIcons: Story = {
  args: {
    backlinks: [
      { id: "page-1", title: "Getting Started", icon: null },
      { id: "page-2", title: "API Reference", icon: null },
      { id: "page-3", title: "Deployment Guide", icon: null },
    ],
  },
};

export const UntitledBacklinks: Story = {
  args: {
    backlinks: [
      { id: "page-1", title: "", icon: null },
      { id: "page-2", title: "Named Page", icon: "📄" },
    ],
  },
};

export const LongTitles: Story = {
  args: {
    backlinks: [
      {
        id: "page-1",
        title: "This Is An Extremely Long Page Title That Should Be Truncated When It Overflows",
        icon: "📋",
      },
      {
        id: "page-2",
        title: "Another Very Long Title For Testing The Truncation Behavior Of Backlink Items",
        icon: null,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    backlinks: [],
  },
};
