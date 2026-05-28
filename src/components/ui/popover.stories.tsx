import type { Meta, StoryObj } from "@storybook/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Popover",
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Open popover</Button>} />
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>
            Set the dimensions for the layer.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="width" className="w-16 text-xs">
              Width
            </Label>
            <Input id="width" defaultValue="100%" className="h-7" />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="height" className="w-16 text-xs">
              Height
            </Label>
            <Input id="height" defaultValue="25px" className="h-7" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignEnd: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm">Settings</Button>} />
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>Settings</PopoverTitle>
        </PopoverHeader>
        <p className="text-xs text-muted-foreground">
          Configure your preferences here.
        </p>
      </PopoverContent>
    </Popover>
  ),
};
