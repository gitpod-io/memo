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
  MessageSquare,
  ChevronRight,
  Grid3X3,
} from "lucide-react";

// The DemoSlashCommandPlugin is a variant of SlashCommandPlugin for the
// landing page demo editor. It excludes Supabase-dependent commands (Image,
// Link to page, Database). Stories show the same menu visual as the full
// slash command plugin but with the reduced command set.

const meta: Meta = {
  title: "Editor/DemoSlashCommandMenu",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

interface CommandOption {
  title: string;
  description: string;
  icon: ReactElement;
}

const demoCommands: CommandOption[] = [
  { title: "Paragraph", description: "Plain text block", icon: <Type className="h-5 w-5" /> },
  { title: "Heading 1", description: "Large section heading", icon: <Heading1 className="h-5 w-5" /> },
  { title: "Heading 2", description: "Medium section heading", icon: <Heading2 className="h-5 w-5" /> },
  { title: "Heading 3", description: "Small section heading", icon: <Heading3 className="h-5 w-5" /> },
  { title: "Bullet List", description: "Unordered list", icon: <List className="h-5 w-5" /> },
  { title: "Numbered List", description: "Ordered list", icon: <ListOrdered className="h-5 w-5" /> },
  { title: "To-do List", description: "Checklist with checkboxes", icon: <CheckSquare className="h-5 w-5" /> },
  { title: "Code Block", description: "Code with syntax highlighting", icon: <Code className="h-5 w-5" /> },
  { title: "Quote", description: "Blockquote", icon: <Quote className="h-5 w-5" /> },
  { title: "Divider", description: "Horizontal rule", icon: <Minus className="h-5 w-5" /> },
  { title: "Table", description: "Insert a 3×3 table", icon: <Grid3X3 className="h-5 w-5" /> },
  { title: "Callout", description: "Highlighted info block", icon: <MessageSquare className="h-5 w-5" /> },
  { title: "Toggle", description: "Collapsible section", icon: <ChevronRight className="h-5 w-5" /> },
];

function StaticDemoSlashMenu({
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
        data-testid="demo-editor-slash-menu"
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
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {option.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** All demo commands — excludes Image, Link to page, and Database. */
export const AllDemoCommands: Story = {
  render: () => (
    <StaticDemoSlashMenu items={demoCommands} selectedIndex={0} />
  ),
};

/** Filtered by search query. */
export const FilteredBySearch: Story = {
  render: () => {
    const filtered = demoCommands.filter((cmd) =>
      cmd.title.toLowerCase().includes("list"),
    );
    return <StaticDemoSlashMenu items={filtered} selectedIndex={0} />;
  },
};

/** Middle item highlighted. */
export const MiddleItemHighlighted: Story = {
  render: () => (
    <StaticDemoSlashMenu items={demoCommands} selectedIndex={7} />
  ),
};

/** Empty filter result. */
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
