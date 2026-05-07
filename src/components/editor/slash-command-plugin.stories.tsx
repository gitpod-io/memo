import type { Meta, StoryObj } from "@storybook/react";
import type { ReactElement } from "react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Minus,
  ImageIcon,
  MessageSquare,
  ChevronRight,
  Link,
  Grid3X3,
  Table2,
} from "lucide-react";

// Static representation of the slash command menu. The actual plugin uses
// LexicalTypeaheadMenuPlugin which requires a full Lexical editor context.
// Stories render the same visual output with controlled state.

interface CommandOption {
  title: string;
  description: string;
  icon: ReactElement;
  shortcut?: string;
}

const allCommands: CommandOption[] = [
  { title: "Paragraph", description: "Plain text block", icon: <Type className="h-5 w-5" /> },
  { title: "Heading 1", description: "Large section heading", icon: <Heading1 className="h-5 w-5" />, shortcut: "# Space" },
  { title: "Heading 2", description: "Medium section heading", icon: <Heading2 className="h-5 w-5" />, shortcut: "## Space" },
  { title: "Heading 3", description: "Small section heading", icon: <Heading3 className="h-5 w-5" />, shortcut: "### Space" },
  { title: "Bullet List", description: "Unordered list", icon: <List className="h-5 w-5" />, shortcut: "- Space" },
  { title: "Numbered List", description: "Ordered list", icon: <ListOrdered className="h-5 w-5" />, shortcut: "1. Space" },
  { title: "To-do List", description: "Checklist with checkboxes", icon: <CheckSquare className="h-5 w-5" />, shortcut: "[] Space" },
  { title: "Code Block", description: "Code with syntax highlighting", icon: <Code className="h-5 w-5" />, shortcut: "```" },
  { title: "Quote", description: "Blockquote", icon: <Quote className="h-5 w-5" />, shortcut: "> Space" },
  { title: "Divider", description: "Horizontal rule", icon: <Minus className="h-5 w-5" />, shortcut: "---" },
  { title: "Table", description: "Insert a 3×3 table", icon: <Grid3X3 className="h-5 w-5" /> },
  { title: "Image", description: "Upload an image", icon: <ImageIcon className="h-5 w-5" /> },
  { title: "Callout", description: "Highlighted info block", icon: <MessageSquare className="h-5 w-5" /> },
  { title: "Toggle", description: "Collapsible section", icon: <ChevronRight className="h-5 w-5" /> },
  { title: "Link to page", description: "Insert a link to another page", icon: <Link className="h-5 w-5" /> },
  { title: "Database", description: "Embed an inline database view", icon: <Table2 className="h-5 w-5" /> },
];

function StaticSlashCommandMenu({
  items,
  selectedIndex = 0,
}: {
  items: CommandOption[];
  selectedIndex?: number;
}) {
  return (
    <div className="mx-auto max-w-xs">
      <div
        className="max-h-[300px] w-64 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
        role="listbox"
        aria-label="Slash commands"
      >
        {items.map((option, index) => (
          <button
            key={option.title}
            type="button"
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
              selectedIndex === index
                ? "bg-overlay-active text-foreground"
                : "text-muted-foreground hover:bg-overlay-hover"
            }`}
            role="option"
            aria-selected={selectedIndex === index}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
              {option.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">
                {option.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
            {option.shortcut && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {option.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Editor/SlashCommandMenu",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Menu open with all default items, first item highlighted. */
export const DefaultItems: Story = {
  render: () => <StaticSlashCommandMenu items={allCommands} selectedIndex={0} />,
};

/** Menu filtered by search — typing "head" shows heading options. */
export const FilteredBySearch: Story = {
  render: () => {
    const filtered = allCommands.filter((cmd) =>
      cmd.title.toLowerCase().includes("head")
    );
    return <StaticSlashCommandMenu items={filtered} selectedIndex={0} />;
  },
};

/** Empty filter result — no commands match the search query. */
export const EmptyFilterResult: Story = {
  render: () => (
    <div className="mx-auto max-w-xs">
      <div
        className="w-64 rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
        role="listbox"
        aria-label="Slash commands"
      >
        <div className="px-2 py-3 text-center text-xs text-muted-foreground">
          No matching commands
        </div>
      </div>
    </div>
  ),
};

/** Menu with a middle item highlighted (Code Block). */
export const MiddleItemHighlighted: Story = {
  render: () => <StaticSlashCommandMenu items={allCommands} selectedIndex={7} />,
};

/** Menu shown in context below a slash trigger. */
export const InContext: Story = {
  render: () => {
    const visibleItems = allCommands.slice(0, 6);
    return (
      <div className="mx-auto max-w-2xl space-y-2">
        <p className="text-sm text-foreground">
          Start typing a command with{" "}
          <span className="bg-muted px-1 text-foreground">/</span>
        </p>
        <StaticSlashCommandMenu items={visibleItems} selectedIndex={0} />
      </div>
    );
  },
};
