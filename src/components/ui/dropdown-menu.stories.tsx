import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import {
  Download,
  LogOut,
  Settings,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta: Meta<typeof DropdownMenu> = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
};

export { meta as default };

type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <Settings className="h-4 w-4" />
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Users className="h-4 w-4" />
            Members
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Download className="h-4 w-4" />
          Export
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Upload className="h-4 w-4" />
          Import
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open menu/i });

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByText("Settings")).toBeVisible();
      expect(canvas.getByText("Export")).toBeVisible();
      expect(canvas.getByText("Delete")).toBeVisible();
    });

    // Close by pressing Escape
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(canvas.queryByText("Export")).not.toBeInTheDocument();
    });
  },
};

export const WithSignOut: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        User menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="px-1.5 py-1">
          <p className="text-sm font-medium">Jane Doe</p>
          <p className="text-xs text-muted-foreground">jane@example.com</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
