import type { Meta, StoryObj } from "@storybook/react";
import { PanelLeft } from "lucide-react";

// MobileHeaderTitle reads document.title via MutationObserver — stories
// render the visual layout statically to show truncation and alignment.

const meta: Meta = {
  title: "Sidebar/MobileHeaderTitle",
  parameters: {
    layout: "fullscreen",
  },
};

export { meta as default };

type Story = StoryObj;

function MobileHeader({ title }: { title: string }) {
  return (
    <div className="w-[375px] bg-background">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-overlay-border px-4">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-overlay-hover"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          data-testid="mobile-header-title"
        >
          {title}
        </span>
      </header>
    </div>
  );
}

/** Page title displayed next to the sidebar toggle. */
export const PageTitle: Story = {
  render: () => <MobileHeader title="Getting Started" />,
};

/** Workspace home shows the workspace name. */
export const WorkspaceName: Story = {
  render: () => <MobileHeader title="My Workspace" />,
};

/** Settings page shows the section name. */
export const SettingsPage: Story = {
  render: () => <MobileHeader title="Settings — My Workspace" />,
};

/** Long title truncated with ellipsis. */
export const LongTitle: Story = {
  render: () => (
    <MobileHeader title="This Is a Very Long Page Title That Should Be Truncated With an Ellipsis on Small Screens" />
  ),
};

/** Empty title — component hidden when no title is available. */
export const EmptyTitle: Story = {
  render: () => (
    <div className="w-[375px] bg-background">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-overlay-border px-4">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-overlay-hover"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {/* MobileHeaderTitle returns null when title is empty */}
      </header>
    </div>
  ),
};
