import type { Meta, StoryObj } from "@storybook/react";
import {
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meta: Meta = {
  title: "Sidebar/UserMenu",
};

export { meta as default };

type Story = StoryObj;

// UserMenu uses next/navigation and Supabase auth. This story renders
// the visual appearance with static data.
export const Default: Story = {
  render: () => (
    <div className="w-56">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
              size="sm"
            />
          }
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">Jane Doe</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={4}>
          <div className="px-1.5 py-1">
            <p className="text-sm font-medium">Jane Doe</p>
            <p className="text-xs text-muted-foreground">jane@example.com</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Users className="h-4 w-4" />
            Members
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};
