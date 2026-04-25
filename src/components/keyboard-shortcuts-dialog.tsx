"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

function getShortcutSections(isMac: boolean): ShortcutSection[] {
  const mod = isMac ? "⌘" : "Ctrl";

  return [
    {
      title: "Global",
      shortcuts: [
        { keys: [mod, "K"], description: "Search pages" },
        { keys: [mod, "N"], description: "New page" },
        { keys: [mod, "\\"], description: "Toggle sidebar" },
        { keys: [mod, "Shift", "F"], description: "Toggle focus mode" },
        { keys: ["?"], description: "Keyboard shortcuts" },
      ],
    },
    {
      title: "Editor — Formatting",
      shortcuts: [
        { keys: [mod, "B"], description: "Bold" },
        { keys: [mod, "I"], description: "Italic" },
        { keys: [mod, "U"], description: "Underline" },
        { keys: [mod, "E"], description: "Inline code" },
        { keys: [mod, "K"], description: "Insert link" },
        { keys: [mod, "Z"], description: "Undo" },
        { keys: [mod, "Shift", "Z"], description: "Redo" },
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
    {
      title: "Database Board",
      shortcuts: [
        { keys: ["↑", "↓"], description: "Navigate between cards in a column" },
        { keys: ["←", "→"], description: "Navigate between columns" },
        { keys: ["Enter"], description: "Open the focused card" },
        { keys: ["Escape"], description: "Clear card focus" },
      ],
    },
    {
      title: "Database Gallery",
      shortcuts: [
        { keys: ["←", "→"], description: "Navigate between cards" },
        { keys: ["↑", "↓"], description: "Navigate between rows" },
        { keys: ["Enter"], description: "Open the focused card" },
        { keys: ["Escape"], description: "Clear card focus" },
      ],
    },
    {
      title: "Database List",
      shortcuts: [
        { keys: ["↑", "↓"], description: "Navigate between rows" },
        { keys: ["Enter"], description: "Open focused row" },
        { keys: ["Home"], description: "Jump to first row" },
        { keys: ["End"], description: "Jump to last row" },
        { keys: ["Escape"], description: "Clear focus" },
      ],
    },
    {
      title: "Database Calendar",
      shortcuts: [
        { keys: ["←"], description: "Previous month" },
        { keys: ["→"], description: "Next month" },
      ],
    },
  ];
}

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const [isMac] = useState(
    () => typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")
  );

  const sections = getShortcutSections(isMac);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
