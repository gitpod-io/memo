import type { Meta, StoryObj } from "@storybook/react";
import { ArrowDown, ArrowRight, MoreHorizontal, Trash2 } from "lucide-react";

// The TableActionMenuPlugin renders a context menu for table operations
// (insert/delete rows and columns). It requires Lexical context — stories
// show the static visual output of the trigger button and menu.

const meta: Meta = {
  title: "Editor/TableActionMenu",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Trigger button shown on table cell hover. */
export const TriggerButton: Story = {
  render: () => (
    <div className="mx-auto max-w-xs">
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Cell content</span>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center text-muted-foreground opacity-60 hover:opacity-100"
          aria-label="Table actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ),
};

/** Context menu open with all table actions. */
export const MenuOpen: Story = {
  render: () => (
    <div className="mx-auto max-w-xs">
      <div className="w-48 overflow-hidden rounded-sm border border-overlay-border bg-popover p-1 shadow-md">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        >
          <ArrowDown className="h-4 w-4 rotate-180" />
          Insert row above
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        >
          <ArrowDown className="h-4 w-4" />
          Insert row below
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Insert column left
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          Insert column right
        </button>
        <div className="my-1 border-t border-overlay-border" />
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        >
          <Trash2 className="h-4 w-4" />
          Delete row
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        >
          <Trash2 className="h-4 w-4" />
          Delete column
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        >
          <Trash2 className="h-4 w-4" />
          Delete table
        </button>
      </div>
    </div>
  ),
};

/** Menu shown in context next to a table. */
export const InContext: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <table className="w-full border-collapse border border-overlay-border text-sm">
        <thead>
          <tr>
            <th className="border border-overlay-border bg-muted px-3 py-1.5 text-left font-medium text-foreground">
              Name
            </th>
            <th className="border border-overlay-border bg-muted px-3 py-1.5 text-left font-medium text-foreground">
              Role
            </th>
            <th className="relative border border-overlay-border bg-muted px-3 py-1.5 text-left font-medium text-foreground">
              Status
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-muted-foreground opacity-60 hover:opacity-100"
                aria-label="Table actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Alice
            </td>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Engineer
            </td>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Active
            </td>
          </tr>
          <tr>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Bob
            </td>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Designer
            </td>
            <td className="border border-overlay-border px-3 py-1.5 text-foreground">
              Active
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};
