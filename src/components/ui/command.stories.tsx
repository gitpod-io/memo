import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Settings, User } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta: Meta<typeof Command> = {
  title: "UI/Command",
  component: Command,
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj<typeof Command>;

/** Default command menu with groups and items. */
export const Default: Story = {
  render: () => (
    <div className="w-[400px] border border-overlay-border shadow-md">
      <Command className="bg-popover">
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <FileText className="h-4 w-4" />
              <span>New Page</span>
            </CommandItem>
            <CommandItem>
              <FileText className="h-4 w-4" />
              <span>Search Pages</span>
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <User className="h-4 w-4" />
              <span>Profile</span>
            </CommandItem>
            <CommandItem>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
};

/** Empty state when no items match. */
export const Empty: Story = {
  render: () => (
    <div className="w-[400px] border border-overlay-border shadow-md">
      <Command className="bg-popover">
        <CommandInput placeholder="Search…" value="nonexistent" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  ),
};
