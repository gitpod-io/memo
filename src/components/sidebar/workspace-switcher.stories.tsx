import type { Meta, StoryObj } from "@storybook/react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meta: Meta = {
  title: "Sidebar/WorkspaceSwitcher",
};

export { meta as default };

type Story = StoryObj;

// WorkspaceSwitcher uses next/navigation and Supabase. This story
// renders the visual appearance with static data.
export const Default: Story = {
  render: () => (
    <div className="w-56">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="w-full justify-between gap-2 px-2"
              size="sm"
              aria-label="Switch workspace"
            />
          }
        >
          <span className="truncate text-sm font-medium">My Workspace</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
          <p className="px-1.5 py-1 text-xs tracking-widest uppercase text-white/30">
            Workspaces
          </p>
          <DropdownMenuItem>
            <span className="flex-1 truncate">Personal</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span className="flex-1 truncate">My Workspace</span>
            <Check className="h-4 w-4 shrink-0 text-accent" />
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span className="flex-1 truncate">Team Alpha</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Plus className="h-4 w-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};
