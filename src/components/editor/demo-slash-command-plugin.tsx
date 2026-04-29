"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from "@lexical/list";
import { $createCodeNode } from "@lexical/code";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  type TextNode,
} from "lexical";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Minus,
  Type,
  MessageSquare,
  ChevronRight,
  Grid3X3,
} from "lucide-react";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import type { JSX, ReactElement } from "react";
import { INSERT_CALLOUT_COMMAND } from "@/components/editor/callout-plugin";
import { INSERT_COLLAPSIBLE_COMMAND } from "@/components/editor/collapsible-plugin";

class SlashCommandOption extends MenuOption {
  title: string;
  description: string;
  icon: ReactElement;
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: {
      description: string;
      icon: ReactElement;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.description = options.description;
    this.icon = options.icon;
    this.onSelect = options.onSelect;
  }
}

/**
 * Slash command plugin for the demo editor. Excludes Supabase-dependent commands
 * (Image upload, Link to page, Database, Turn into) to avoid broken interactions.
 */
export function DemoSlashCommandPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const baseOptions = useMemo(
    () => [
      new SlashCommandOption("Paragraph", {
        description: "Plain text block",
        icon: <Type className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createParagraphNode();
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Heading 1", {
        description: "Large section heading",
        icon: <Heading1 className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createHeadingNode("h1");
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Heading 2", {
        description: "Medium section heading",
        icon: <Heading2 className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createHeadingNode("h2");
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Heading 3", {
        description: "Small section heading",
        icon: <Heading3 className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createHeadingNode("h3");
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Bullet List", {
        description: "Unordered list",
        icon: <List className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
      }),
      new SlashCommandOption("Numbered List", {
        description: "Ordered list",
        icon: <ListOrdered className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        },
      }),
      new SlashCommandOption("To-do List", {
        description: "Checklist with checkboxes",
        icon: <CheckSquare className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        },
      }),
      new SlashCommandOption("Code Block", {
        description: "Code with syntax highlighting",
        icon: <Code className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createCodeNode("plain");
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Quote", {
        description: "Blockquote",
        icon: <Quote className="h-5 w-5" />,
        onSelect: () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = $createQuoteNode();
              selection.insertNodes([node]);
            }
          });
        },
      }),
      new SlashCommandOption("Divider", {
        description: "Horizontal rule",
        icon: <Minus className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
        },
      }),
      new SlashCommandOption("Table", {
        description: "Insert a 3×3 table",
        icon: <Grid3X3 className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_TABLE_COMMAND, {
            columns: "3",
            rows: "3",
            includeHeaders: { rows: true, columns: false },
          });
        },
      }),
      new SlashCommandOption("Callout", {
        description: "Highlighted info block",
        icon: <MessageSquare className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_CALLOUT_COMMAND, {});
        },
      }),
      new SlashCommandOption("Toggle", {
        description: "Collapsible section",
        icon: <ChevronRight className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, undefined);
        },
      }),
    ],
    [editor],
  );

  const options = useMemo(() => {
    if (queryString) {
      const lower = queryString.toLowerCase();
      return baseOptions.filter((option) =>
        option.title.toLowerCase().includes(lower),
      );
    }
    return baseOptions;
  }, [baseOptions, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: SlashCommandOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        if (nodeToReplace) {
          nodeToReplace.remove();
        }
      });
      selectedOption.onSelect(matchingString);
      closeMenu();
    },
    [editor],
  );

  const scrollHighlightedIntoView = useCallback((index: number) => {
    const container = menuRef.current;
    if (!container) return;
    const item = container.children[index];
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const lastScrolledIndex = useRef<number | null>(null);

  return (
    <LexicalTypeaheadMenuPlugin<SlashCommandOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        {
          selectedIndex,
          selectOptionAndCleanUp,
          setHighlightedIndex,
          options: items,
        },
      ) => {
        if (items.length === 0 || !anchorElementRef.current) {
          return null;
        }

        if (
          selectedIndex !== null &&
          selectedIndex !== lastScrolledIndex.current
        ) {
          lastScrolledIndex.current = selectedIndex;
          requestAnimationFrame(() => scrollHighlightedIntoView(selectedIndex));
        }

        return createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 max-h-[300px] w-64 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
            role="listbox"
            aria-label="Slash commands"
            data-testid="demo-editor-slash-menu"
          >
            {items.map((option, index) => (
              <button
                key={option.key}
                ref={(el) => option.setRefElement(el)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
                  selectedIndex === index
                    ? "bg-overlay-active text-foreground"
                    : "text-muted-foreground hover:bg-overlay-hover"
                }`}
                onClick={() => selectOptionAndCleanUp(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
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
          </div>,
          anchorElementRef.current,
        );
      }}
    />
  );
}
