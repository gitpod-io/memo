import type { Meta, StoryObj } from "@storybook/react";
import { Copy, Download, MoreHorizontal, Star, StarOff, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// PageMenu depends on next/navigation, Supabase, Lexical editor ref,
// and markdown-utils. These stories render the visual menu states.

const meta: Meta = {
  title: "Components/PageMenu",
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Page actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem>
          <Star className="h-4 w-4" />
          Add to favorites
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Upload className="h-4 w-4" />
          Import Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const MenuOpen: Story = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Page actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem>
          <Star className="h-4 w-4" />
          Add to favorites
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Upload className="h-4 w-4" />
          Import Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const MenuOpenFavorited: Story = {
  name: "Menu Open (Favorited)",
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Page actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem>
          <StarOff className="h-4 w-4" />
          Remove from favorites
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Upload className="h-4 w-4" />
          Import Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
