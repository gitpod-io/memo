import type { Meta, StoryObj } from "@storybook/react";

// SettingsPageClient is a thin dynamic import wrapper for SettingsPageContent.
// Stories show the loading state of the wrapper.

const meta: Meta = {
  title: "Components/SettingsPageClient",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Loading state — skeleton while SettingsPageContent loads. */
export const Loading: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  ),
};

/** Loaded state — full settings page content. */
export const Loaded: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Workspace settings
        </h1>
        <a
          href="#"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Members
        </a>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace name, URL, and other settings.
      </p>
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Workspace name
          </label>
          <input
            type="text"
            defaultValue="My Workspace"
            className="h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Workspace URL
          </label>
          <input
            type="text"
            defaultValue="my-workspace"
            className="h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground"
          />
        </div>
        <button
          type="button"
          className="h-9 rounded-sm bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          Save changes
        </button>
      </div>
    </div>
  ),
};
