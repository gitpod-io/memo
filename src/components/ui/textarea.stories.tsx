import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
};

export { meta as default };

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <Textarea placeholder="Type something…" rows={4} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor="demo-textarea">Message</Label>
      <Textarea id="demo-textarea" placeholder="What's on your mind?" rows={4} />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <Textarea placeholder="Disabled textarea" rows={4} disabled />
    </div>
  ),
};

export const WithValue: Story = {
  render: () => (
    <div className="w-80">
      <Textarea
        defaultValue="This textarea has some content already filled in."
        rows={4}
      />
    </div>
  ),
};
