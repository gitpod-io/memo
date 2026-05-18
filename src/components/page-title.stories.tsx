import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

const meta: Meta = {
  title: "Components/PageTitle",
};

export { meta as default };

type Story = StoryObj;

// PageTitle uses Supabase for persistence. These stories render the
// visual appearance without the data layer.
export const Default: Story = {
  render: () => (
    <input
      type="text"
      defaultValue="Getting Started"
      placeholder="Untitled"
      className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground outline-none"
      aria-label="Page title"
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <input
      type="text"
      defaultValue=""
      placeholder="Untitled"
      className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground outline-none"
      aria-label="Page title"
    />
  ),
};

export const LongTitle: Story = {
  render: () => (
    <div className="max-w-2xl">
      <input
        type="text"
        defaultValue="This is a very long page title that should demonstrate how the component handles overflow and wrapping in the layout"
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground outline-none"
        aria-label="Page title"
      />
    </div>
  ),
};

/**
 * Demonstrates the Enter/Tab → editor focus transfer pattern.
 * Press Enter or Tab in the title to see the onAdvance callback fire
 * and focus move to the mock editor area below.
 */
export const WithAdvance: Story = {
  args: {
    onAdvance: fn(),
  },
  render: (args) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        (args as { onAdvance: () => void }).onAdvance();
        const editor = document.getElementById("mock-editor");
        editor?.focus();
      }
    };

    return (
      <div className="space-y-4">
        <input
          type="text"
          defaultValue="My Page Title"
          placeholder="Untitled"
          className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Page title"
          onKeyDown={handleKeyDown}
        />
        <div
          id="mock-editor"
          tabIndex={0}
          className="min-h-[200px] rounded border border-border p-4 text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          Editor area (press Enter or Tab in the title to focus here)
        </div>
      </div>
    );
  },
};
