import type { Meta, StoryObj } from "@storybook/react";

// Providers wraps the app with ThemeProvider, TooltipProvider, and Toaster.
// It has no visual output of its own — stories show the provided context
// in action (theme switching, tooltip rendering, toast notifications).

const meta: Meta = {
  title: "Components/Providers",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Light theme context — components render with light colors. */
export const LightTheme: Story = {
  render: () => (
    <div className="rounded-sm border border-overlay-border bg-background p-6">
      <h2 className="text-lg font-semibold text-foreground">Light Theme</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The Providers component wraps the app with ThemeProvider (light/dark),
        TooltipProvider, and a themed Toaster for notifications.
      </p>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-8 rounded bg-background border border-overlay-border" title="background" />
        <div className="h-8 w-8 rounded bg-foreground" title="foreground" />
        <div className="h-8 w-8 rounded bg-accent" title="accent" />
        <div className="h-8 w-8 rounded bg-muted" title="muted" />
        <div className="h-8 w-8 rounded bg-destructive" title="destructive" />
      </div>
    </div>
  ),
};

/** Dark theme context — components render with dark colors. */
export const DarkTheme: Story = {
  render: () => (
    <div className="rounded-sm border border-overlay-border bg-[#1a1a1a] p-6">
      <h2 className="text-lg font-semibold text-[#fafafa]">Dark Theme</h2>
      <p className="mt-2 text-sm text-[#a1a1aa]">
        In dark mode, the ThemeProvider sets the resolved theme to
        &quot;dark&quot; and the Toaster renders with dark styling.
      </p>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-8 rounded bg-[#1a1a1a] border border-[#2a2a2a]" title="background" />
        <div className="h-8 w-8 rounded bg-[#fafafa]" title="foreground" />
        <div className="h-8 w-8 rounded bg-[#3b82f6]" title="accent" />
        <div className="h-8 w-8 rounded bg-[#27272a]" title="muted" />
        <div className="h-8 w-8 rounded bg-[#ef4444]" title="destructive" />
      </div>
    </div>
  ),
};

/** Toast notification examples. */
export const ToastExamples: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="rounded-sm border border-overlay-border bg-popover px-4 py-3 shadow-md">
        <p className="text-sm font-medium text-foreground">
          Page saved successfully
        </p>
      </div>
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 shadow-md">
        <p className="text-sm font-medium text-destructive">
          Failed to save page. Please try again.
        </p>
      </div>
      <div className="rounded-sm border border-overlay-border bg-popover px-4 py-3 shadow-md">
        <p className="text-sm font-medium text-foreground">
          Workspace created
        </p>
        <p className="text-xs text-muted-foreground">
          You can now invite members.
        </p>
      </div>
    </div>
  ),
};
