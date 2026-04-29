import type { Meta, StoryObj } from "@storybook/react";
import { LandingDemoEditor } from "./landing-demo-editor";

const meta: Meta<typeof LandingDemoEditor> = {
  title: "Landing/DemoEditor",
  component: LandingDemoEditor,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Try the editor
        </p>
        <Story />
        <p className="text-xs text-muted-foreground">
          Your content is saved in this browser session. Sign up to save
          permanently.
        </p>
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
  },
};

export { meta as default };
type Story = StoryObj<typeof LandingDemoEditor>;

/** Default state with the editor wrapper. */
export const Default: Story = {};
