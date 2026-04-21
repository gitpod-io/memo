import type { Meta, StoryObj } from "@storybook/react";
import { FileText } from "lucide-react";

// The actual PageLinkComponent is internal to page-link-node.tsx and fetches
// data from Supabase. This story renders the same visual states with static data.

function PageLinkPill({
  title,
  icon,
  deleted,
  loading,
}: {
  title: string;
  icon: string | null;
  deleted?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground align-baseline">
        <span className="inline-block h-3.5 w-16 animate-pulse bg-white/[0.08]" />
      </span>
    );
  }

  if (deleted) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground line-through align-baseline">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Deleted page
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-foreground hover:bg-white/[0.08] align-baseline cursor-pointer">
      {icon ? (
        <span className="shrink-0 text-sm">{icon}</span>
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="underline decoration-muted-foreground/50 underline-offset-2">
        {title}
      </span>
    </span>
  );
}

const meta: Meta<typeof PageLinkPill> = {
  title: "Editor/PageLinkPill",
  component: PageLinkPill,
  decorators: [
    (Story) => (
      <div className="bg-background p-6 text-sm text-foreground">
        <p>
          Here is some text with an inline page link:{" "}
          <Story />
          {" "}and more text after it.
        </p>
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof PageLinkPill>;

export const WithIcon: Story = {
  args: {
    title: "Project Overview",
    icon: "📋",
  },
};

export const WithoutIcon: Story = {
  args: {
    title: "Getting Started",
    icon: null,
  },
};

export const Untitled: Story = {
  args: {
    title: "Untitled",
    icon: null,
  },
};

export const Deleted: Story = {
  args: {
    title: "",
    icon: null,
    deleted: true,
  },
};

export const Loading: Story = {
  args: {
    title: "",
    icon: null,
    loading: true,
  },
};

export const LongTitle: Story = {
  args: {
    title: "This Is A Very Long Page Title That Might Need Special Handling",
    icon: "📝",
  },
};
