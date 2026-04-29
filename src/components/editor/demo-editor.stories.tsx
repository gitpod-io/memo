import type { Meta, StoryObj } from "@storybook/react";
import { DemoEditor } from "./demo-editor";

const meta: Meta<typeof DemoEditor> = {
  title: "Editor/DemoEditor",
  component: DemoEditor,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
  },
};

export { meta as default };
type Story = StoryObj<typeof DemoEditor>;

/** Default empty state — shows placeholder text. */
export const Default: Story = {};

/** Wrapped in the landing page container to show how it appears on the landing page. */
export const InLandingContainer: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Try the editor
        </p>
        <div className="w-full border border-overlay-border bg-background p-6">
          <Story />
        </div>
        <p className="text-xs text-muted-foreground">
          Your content is saved in this browser session. Sign up to save
          permanently.
        </p>
      </div>
    ),
  ],
};
