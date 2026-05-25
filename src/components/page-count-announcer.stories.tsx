import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PageCountAnnouncer } from "./page-count-announcer";

const meta: Meta<typeof PageCountAnnouncer> = {
  title: "Components/PageCountAnnouncer",
  component: PageCountAnnouncer,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PageCountAnnouncer>;

/** Default state — no announcement yet (initial render is silent) */
export const Default: Story = {
  args: {
    filteredCount: 12,
    totalCount: 42,
  },
};

/** Interactive demo — toggle counts to trigger announcements */
export const Interactive: Story = {
  render: function InteractiveDemo() {
    const [filtered, setFiltered] = useState(42);
    const total = 42;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          The live region is visually hidden (sr-only). Use a screen reader or
          inspect the DOM to observe announcements. Click the buttons below to
          change the filtered count.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
            onClick={() => setFiltered(42)}
          >
            Show all (42)
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
            onClick={() => setFiltered(12)}
          >
            Filter to 12
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
            onClick={() => setFiltered(0)}
          >
            Filter to 0
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Current: {filtered} of {total} pages
        </div>
        <PageCountAnnouncer filteredCount={filtered} totalCount={total} />
      </div>
    );
  },
};
