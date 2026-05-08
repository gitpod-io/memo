import type { Meta, StoryObj } from "@storybook/react";
import { HardDrive, RefreshCw } from "lucide-react";

// The LocalPersistencePlugin saves editor state to sessionStorage on every
// change (debounced). It returns null — stories document the persistence
// behavior and storage states.

const meta: Meta = {
  title: "Editor/LocalPersistencePlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Saved state indicator — content persisted to sessionStorage. */
export const SavedState: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-2 rounded-sm border border-overlay-border bg-popover px-3 py-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            Content saved locally
          </span>
          <span className="text-xs text-muted-foreground">
            Stored in sessionStorage (key:{" "}
            <code className="rounded bg-muted px-1">
              memo-demo-editor-content
            </code>
            )
          </span>
        </div>
      </div>
    </div>
  ),
};

/** Restoring state — content loaded from sessionStorage on mount. */
export const RestoringState: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-2 rounded-sm border border-overlay-border bg-popover px-3 py-2">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            Restoring saved content
          </span>
          <span className="text-xs text-muted-foreground">
            Loading previous session from browser storage…
          </span>
        </div>
      </div>
    </div>
  ),
};

/** Size limit exceeded — content too large to save. */
export const SizeLimitExceeded: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
        <HardDrive className="h-4 w-4 text-yellow-500" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            Content not saved
          </span>
          <span className="text-xs text-muted-foreground">
            Content exceeds 100 KB limit — local persistence skipped.
          </span>
        </div>
      </div>
    </div>
  ),
};
