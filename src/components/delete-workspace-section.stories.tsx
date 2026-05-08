import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";

// DeleteWorkspaceSection renders a danger zone with a delete button and
// confirmation dialog. It requires Supabase and router context — stories
// show the static visual output.

const meta: Meta = {
  title: "Components/DeleteWorkspaceSection",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Default state — delete button with warning text. */
export const Default: Story = {
  render: () => (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting this workspace will permanently remove all its pages and
          members. This action cannot be undone.
        </p>
        <button
          type="button"
          className="inline-flex h-8 w-fit items-center gap-2 rounded-sm bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          <Trash2 className="h-4 w-4" />
          Delete workspace
        </button>
      </div>
    </div>
  ),
};

/** Confirmation dialog open. */
export const ConfirmationDialog: Story = {
  render: () => (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting this workspace will permanently remove all its pages and
          members. This action cannot be undone.
        </p>
      </div>
      <div className="mt-6 rounded-sm border border-overlay-border bg-popover p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground">
          Delete workspace
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete &ldquo;My Workspace&rdquo;? All pages
          and members will be permanently removed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-sm border border-overlay-border bg-background px-4 text-sm font-medium text-foreground hover:bg-overlay-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-sm bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Delete workspace
          </button>
        </div>
      </div>
    </div>
  ),
};

/** Deleting state — button disabled with loading text. */
export const Deleting: Story = {
  render: () => (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting this workspace will permanently remove all its pages and
          members. This action cannot be undone.
        </p>
      </div>
      <div className="mt-6 rounded-sm border border-overlay-border bg-popover p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground">
          Delete workspace
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete &ldquo;My Workspace&rdquo;? All pages
          and members will be permanently removed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-sm border border-overlay-border bg-background px-4 text-sm font-medium text-foreground opacity-50"
            disabled
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-sm bg-destructive px-4 text-sm font-medium text-destructive-foreground opacity-50"
            disabled
          >
            Deleting…
          </button>
        </div>
      </div>
    </div>
  ),
};

/** Error state — deletion failed. */
export const WithError: Story = {
  render: () => (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting this workspace will permanently remove all its pages and
          members. This action cannot be undone.
        </p>
        <p className="text-xs text-destructive">
          Failed to delete workspace. Please try again.
        </p>
        <button
          type="button"
          className="inline-flex h-8 w-fit items-center gap-2 rounded-sm bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          <Trash2 className="h-4 w-4" />
          Delete workspace
        </button>
      </div>
    </div>
  ),
};
