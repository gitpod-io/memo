import type { Meta, StoryObj } from "@storybook/react";
import { Check, ExternalLink, Pencil, Trash2, X } from "lucide-react";

// Static representation of the floating link editor. The actual plugin requires
// Lexical context and link node detection — stories render the same visual
// output for each state: viewing a link and editing a link URL.

function StaticLinkEditorView({ url }: { url: string }) {
  return (
    <div
      className="inline-flex items-center gap-1 border border-overlay-border bg-popover px-2 py-1.5 shadow-md rounded-sm"
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-[200px] truncate text-xs text-accent hover:underline"
      >
        {url}
      </a>
      <button
        type="button"
        className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Open link"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Edit link"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-destructive hover:text-destructive/80"
        aria-label="Remove link"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StaticLinkEditorEdit({ url }: { url: string }) {
  return (
    <div
      className="inline-flex items-center gap-1 border border-overlay-border bg-popover px-2 py-1.5 shadow-md rounded-sm"
    >
      <input
        type="url"
        defaultValue={url}
        className="h-6 w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="Enter URL..."
      />
      <button
        type="button"
        className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Save link"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const meta: Meta = {
  title: "Editor/FloatingLinkEditor",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Link selected — view mode showing URL with open, edit, and remove actions. */
export const LinkSelected: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <StaticLinkEditorView url="https://example.com" />
    </div>
  ),
};

/** Edit mode — URL input focused with save and cancel actions. */
export const EditMode: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <StaticLinkEditorEdit url="https://example.com" />
    </div>
  ),
};

/** Edit mode with empty input — new link being created. */
export const EditModeEmpty: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <StaticLinkEditorEdit url="https://" />
    </div>
  ),
};

/** Long URL — truncated in view mode. */
export const LongUrl: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <StaticLinkEditorView url="https://example.com/very/long/path/to/some/deeply/nested/resource/page.html" />
    </div>
  ),
};

/** Link editor shown in context below linked text. */
export const InContext: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <p className="text-sm text-foreground">
        Check out the{" "}
        <a
          href="https://docs.example.com"
          className="text-accent underline decoration-accent/50 underline-offset-2"
        >
          documentation
        </a>{" "}
        for more details.
      </p>
      <StaticLinkEditorView url="https://docs.example.com" />
    </div>
  ),
};
