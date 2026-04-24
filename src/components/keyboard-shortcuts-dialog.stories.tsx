import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const meta: Meta = {
  title: "Components/KeyboardShortcutsDialog",
};

export { meta as default };

type Story = StoryObj;

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}

const macSections: ShortcutSection[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Search pages" },
      { keys: ["⌘", "N"], description: "New page" },
      { keys: ["⌘", "\\"], description: "Toggle sidebar" },
      { keys: ["⌘", "Shift", "F"], description: "Toggle focus mode" },
      { keys: ["?"], description: "Keyboard shortcuts" },
    ],
  },
  {
    title: "Editor — Formatting",
    shortcuts: [
      { keys: ["⌘", "B"], description: "Bold" },
      { keys: ["⌘", "I"], description: "Italic" },
      { keys: ["⌘", "U"], description: "Underline" },
      { keys: ["⌘", "E"], description: "Inline code" },
      { keys: ["⌘", "K"], description: "Insert link" },
      { keys: ["⌘", "Z"], description: "Undo" },
      { keys: ["⌘", "Shift", "Z"], description: "Redo" },
    ],
  },
  {
    title: "Editor — Blocks",
    shortcuts: [
      { keys: ["/"], description: "Slash commands" },
      { keys: ["#", "Space"], description: "Heading 1" },
      { keys: ["##", "Space"], description: "Heading 2" },
      { keys: ["###", "Space"], description: "Heading 3" },
      { keys: ["-", "Space"], description: "Bullet list" },
      { keys: ["1.", "Space"], description: "Numbered list" },
      { keys: ["[]", "Space"], description: "To-do list" },
      { keys: [">", "Space"], description: "Quote" },
      { keys: ["```"], description: "Code block" },
      { keys: ["---"], description: "Divider" },
      { keys: ["Tab"], description: "Indent list item" },
      { keys: ["Shift", "Tab"], description: "Outdent list item" },
    ],
  },
  {
    title: "Database Table",
    shortcuts: [
      { keys: ["↑", "↓", "←", "→"], description: "Navigate between cells" },
      { keys: ["Enter"], description: "Start editing the focused cell" },
      { keys: ["Escape"], description: "Cancel editing / deselect cell" },
      { keys: ["Tab"], description: "Move to next cell" },
      { keys: ["Shift", "Tab"], description: "Move to previous cell" },
    ],
  },
];

function ShortcutsContent({ sections }: { sections: ShortcutSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <h3 className="text-xs tracking-widest uppercase text-label-faint">
            {section.title}
          </h3>
          <div className="flex flex-col gap-1">
            {section.shortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-foreground">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <KeyBadge key={`${shortcut.description}-${i}`}>
                      {key}
                    </KeyBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Renders the dialog in its open state with Mac key labels.
export const Default: Story = {
  render: () => (
    <Dialog open>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ShortcutsContent sections={macSections} />
      </DialogContent>
    </Dialog>
  ),
};

// Renders the dialog with Windows/Linux key labels.
export const WindowsKeys: Story = {
  render: () => {
    const sections = macSections.map((s) => ({
      ...s,
      shortcuts: s.shortcuts.map((sc) => ({
        ...sc,
        keys: sc.keys.map((k) => (k === "⌘" ? "Ctrl" : k)),
      })),
    }));
    return (
      <Dialog open>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <ShortcutsContent sections={sections} />
        </DialogContent>
      </Dialog>
    );
  },
};
