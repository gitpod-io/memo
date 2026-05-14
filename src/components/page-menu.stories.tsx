import type { Meta, StoryObj } from "@storybook/react";
import { Copy, Download, History, Maximize2, MoreHorizontal, Star, StarOff, Upload } from "lucide-react";
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

function MenuItems({ favorited = false }: { favorited?: boolean }) {
  return (
    <>
      <DropdownMenuItem>
        {favorited ? (
          <>
            <StarOff className="h-4 w-4" />
            Remove from favorites
          </>
        ) : (
          <>
            <Star className="h-4 w-4" />
            Add to favorites
          </>
        )}
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Copy className="h-4 w-4" />
        Duplicate
        <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <History className="h-4 w-4" />
        Version history
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Maximize2 className="h-4 w-4" />
        Focus mode
        <span className="ml-auto text-xs text-muted-foreground">⌘⇧F</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Download className="h-4 w-4" />
        Export as Markdown
        <span className="ml-auto text-xs text-muted-foreground">⌘⇧E</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Upload className="h-4 w-4" />
        Import Markdown
      </DropdownMenuItem>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Page actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
        <MenuItems />
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
        <MenuItems />
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
        <MenuItems favorited />
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
