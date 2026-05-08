import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";

// DangerZoneSettings is a thin wrapper that dynamically imports
// DeleteAccountSection. Stories show the visual output directly.

const meta: Meta = {
  title: "Components/DangerZoneSettings",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Default state — delete account button with warning text. */
export const Default: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <button
          type="button"
          className="inline-flex h-8 w-fit items-center gap-2 rounded-sm bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </button>
      </div>
    </div>
  ),
};

/** Confirmation dialog open. */
export const ConfirmationDialog: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
      </div>
      {/* Static dialog overlay */}
      <div className="mt-6 rounded-sm border border-overlay-border bg-popover p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground">
          Delete account
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete your account? All workspaces you own
          and their pages will be permanently removed.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Type <strong className="text-foreground">user@example.com</strong> to
          confirm.
        </p>
        <input
          type="email"
          placeholder="user@example.com"
          className="mt-3 h-9 w-full rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-sm border border-overlay-border bg-background px-4 text-sm font-medium text-foreground hover:bg-overlay-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-sm bg-destructive px-4 text-sm font-medium text-destructive-foreground opacity-50"
            disabled
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  ),
};
