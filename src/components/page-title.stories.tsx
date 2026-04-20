import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Components/PageTitle",
};

export { meta as default };

type Story = StoryObj;

// PageTitle uses Supabase for persistence. This story renders the
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
