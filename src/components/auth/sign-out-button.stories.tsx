import type { Meta, StoryObj } from "@storybook/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "Auth/SignOutButton",
};

export { meta as default };

type Story = StoryObj;

// SignOutButton uses next/navigation and Supabase auth. This story
// renders the visual appearance without the runtime dependencies.
export const Default: Story = {
  render: () => (
    <Button variant="ghost" size="sm" className="gap-2">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  ),
};
