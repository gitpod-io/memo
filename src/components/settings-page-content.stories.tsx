import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";

// SettingsPageContent renders the full settings page with workspace form,
// change password section, and danger zone. It requires Supabase context —
// stories show the static visual layout.

const meta: Meta = {
  title: "Components/SettingsPageContent",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Personal workspace settings — shows all sections including password and danger zone. */
export const PersonalWorkspace: Story = {
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
      {/* Workspace form */}
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Workspace name
          </label>
          <input
            type="text"
            defaultValue="Personal"
            className="h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Workspace URL
          </label>
          <input
            type="text"
            defaultValue="personal"
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
      {/* Separator */}
      <div className="mt-8 border-t border-overlay-border" />
      {/* Change password */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-medium text-foreground">
          Change password
        </h2>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">New password</label>
          <input
            type="password"
            className="h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm"
          />
        </div>
        <button
          type="button"
          className="h-9 rounded-sm bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          Update password
        </button>
      </div>
      {/* Separator */}
      <div className="mt-8 border-t border-overlay-border" />
      {/* Danger zone */}
      <div className="mt-8 flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <button
          type="button"
          className="inline-flex h-8 w-fit items-center gap-2 rounded-sm bg-destructive px-3 text-sm font-medium text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </button>
      </div>
    </div>
  ),
};

/** Team workspace settings — no password or danger zone sections. */
export const TeamWorkspace: Story = {
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
            defaultValue="Engineering Team"
            className="h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Workspace URL
          </label>
          <input
            type="text"
            defaultValue="engineering-team"
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
