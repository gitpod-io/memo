import type { Meta, StoryObj } from "@storybook/react";
import Link from "next/link";

/**
 * SettingsTabNav provides tab-style navigation between the General and Members
 * settings pages. Because the real component relies on `usePathname()` (mocked
 * to `"/"` in Storybook), these stories render the visual states directly so
 * every variant is visible without route changes.
 */

const meta: Meta = {
  title: "Components/SettingsTabNav",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function TabNav({
  activeTab,
}: {
  activeTab: "general" | "members" | "none";
}) {
  const tabs = [
    { label: "General", active: activeTab === "general" },
    { label: "Members", active: activeTab === "members" },
  ];

  return (
    <nav className="flex border-b border-overlay-border">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href="#"
          className={`px-3 pb-2 text-sm ${
            tab.active
              ? "border-b-2 border-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** General tab active — shown on the settings page. */
export const GeneralActive: Story = {
  render: () => <TabNav activeTab="general" />,
};

/** Members tab active — shown on the members page. */
export const MembersActive: Story = {
  render: () => <TabNav activeTab="members" />,
};

/** No tab active — fallback when pathname doesn't match either route. */
export const NoneActive: Story = {
  render: () => <TabNav activeTab="none" />,
};

/** Tab nav in context — placed between a heading and content, matching the settings page layout. */
export const InPageContext: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">
        Workspace settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace name, URL, and other settings.
      </p>
      <div className="mt-4">
        <TabNav activeTab="general" />
      </div>
      <div className="mt-6">
        <div className="h-32 rounded-sm border border-overlay-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Page content area
        </div>
      </div>
    </div>
  ),
};
