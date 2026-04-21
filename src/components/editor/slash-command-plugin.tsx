"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createHeadingNode } from "@lexical/rich-text";
import { $createQuoteNode } from "@lexical/rich-text";
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
  ImageIcon,
  MessageSquare,
  ChevronRight,
  Link,
  Grid3X3,
} from "lucide-react";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import type { JSX, ReactElement } from "react";
import { openImagePicker } from "@/components/editor/image-plugin";
import { INSERT_CALLOUT_COMMAND } from "@/components/editor/callout-plugin";
import { INSERT_COLLAPSIBLE_COMMAND } from "@/components/editor/collapsible-plugin";
import { OPEN_PAGE_LINK_MENU_COMMAND } from "@/components/editor/page-link-plugin";

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
    }
  ) {
    super(title);
    this.title = title;
    this.description = options.description;
    this.icon = options.icon;
    this.onSelect = options.onSelect;
  }
}

export function SlashCommandPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  // Create base options once per editor instance so MenuOption refs stay
  // stable across query changes. Recreating options on every keystroke
  // discards the DOM refs that Lexical uses for scroll-into-view, causing
  // the highlighted index to appear to jump back to the top.
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
      new SlashCommandOption("Image", {
        description: "Upload an image",
        icon: <ImageIcon className="h-5 w-5" />,
        onSelect: () => {
          openImagePicker(editor);
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
      new SlashCommandOption("Link to page", {
        description: "Insert a link to another page",
        icon: <Link className="h-5 w-5" />,
        onSelect: () => {
          editor.dispatchCommand(OPEN_PAGE_LINK_MENU_COMMAND, undefined);
        },
      }),
    ],
    [editor]
  );

  // Filter separately so base option objects (and their refs) persist.
  const options = useMemo(() => {
    if (queryString) {
      const lower = queryString.toLowerCase();
      return baseOptions.filter((option) =>
        option.title.toLowerCase().includes(lower)
      );
    }
    return baseOptions;
  }, [baseOptions, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: SlashCommandOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
      matchingString: string
    ) => {
      editor.update(() => {
        if (nodeToReplace) {
          nodeToReplace.remove();
        }
      });
      selectedOption.onSelect(matchingString);
      closeMenu();
    },
    [editor]
  );

  // Scroll the highlighted item into view within the menu's scrollable
  // container. Lexical's built-in SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND
  // targets the #typeahead-menu anchor div, not the overflow-y-auto menu
  // div we render, so it cannot scroll items within our container.
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
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options: items }
      ) => {
        if (items.length === 0 || !anchorElementRef.current) {
          return null;
        }

        // Scroll the newly highlighted item into view when the index changes.
        // We track the last scrolled index to avoid redundant calls.
        if (
          selectedIndex !== null &&
          selectedIndex !== lastScrolledIndex.current
        ) {
          lastScrolledIndex.current = selectedIndex;
          // Defer to after React has committed the DOM update
          requestAnimationFrame(() => scrollHighlightedIntoView(selectedIndex));
        }

        return createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 max-h-[300px] w-64 overflow-y-auto rounded-sm border border-white/[0.06] bg-popover p-1 shadow-md"
          >
            {items.map((option, index) => (
              <button
                key={option.key}
                ref={(el) => option.setRefElement(el)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
                  selectedIndex === index
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04]"
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
          anchorElementRef.current
        );
      }}
    />
  );
}
