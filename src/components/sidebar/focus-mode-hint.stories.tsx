import type { Meta, StoryObj } from "@storybook/react";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "Components/FocusModeHint",
};

export { meta as default };

type Story = StoryObj;

function HintButton({ shortcut }: { shortcut: string }) {
  return (
    <div className="fixed right-4 top-4 z-50">
      <Button
        variant="secondary"
        size="sm"
        className="gap-2 text-xs text-muted-foreground"
        aria-label="Exit focus mode"
      >
        <Minimize2 className="h-3 w-3" />
        Exit focus mode
        <kbd className="ml-1 text-xs text-white/30">{shortcut}</kbd>
      </Button>
    </div>
  );
}

export const MacShortcut: Story = {
  render: () => <HintButton shortcut="⌘⇧F" />,
};

export const WindowsShortcut: Story = {
  render: () => <HintButton shortcut="Ctrl+Shift+F" />,
};
