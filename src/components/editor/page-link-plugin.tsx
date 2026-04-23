"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  createCommand,
  type LexicalCommand,
} from "lexical";
import {
  $createPageLinkNode,
  PageLinkNode,
} from "@/components/editor/page-link-node";
import { FileText, Search } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import type { JSX } from "react";

export const INSERT_PAGE_LINK_COMMAND: LexicalCommand<{ pageId: string }> =
  createCommand("INSERT_PAGE_LINK_COMMAND");

// Command to open the page link search menu (used by slash command plugin)
export const OPEN_PAGE_LINK_MENU_COMMAND: LexicalCommand<void> =
  createCommand("OPEN_PAGE_LINK_MENU_COMMAND");

interface PageResult {
  id: string;
  title: string;
  icon: string | null;
}

export function PageLinkPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const params = useParams<{ workspaceSlug?: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PageResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const matchStartRef = useRef<number | null>(null);
  const matchNodeKeyRef = useRef<string | null>(null);
  // Tracks whether the menu was opened via slash command (true) or [[ trigger (false)
  const [isSlashCommandMode, setIsSlashCommandMode] = useState(false);

  // Resolve workspace slug to ID
  useEffect(() => {
    if (!params.workspaceSlug) return;
    let cancelled = false;

    async function resolve() {
      const supabase = await getClient();
      const { data } = await supabase
        .from("workspaces")
        .select("id")
        .eq("slug", params.workspaceSlug)
        .maybeSingle();
      if (!cancelled && data) {
        setWorkspaceId(data.id);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [params.workspaceSlug]);

  // Verify PageLinkNode is registered
  useEffect(() => {
    if (!editor.hasNodes([PageLinkNode])) {
      throw new Error(
        "PageLinkPlugin: PageLinkNode not registered on editor. Add it to initialConfig.nodes.",
      );
    }
  }, [editor]);

  // Register INSERT_PAGE_LINK_COMMAND
  useEffect(() => {
    return editor.registerCommand(
      INSERT_PAGE_LINK_COMMAND,
      (payload: { pageId: string }) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = $createPageLinkNode({ pageId: payload.pageId });
          selection.insertNodes([node]);
          const space = $createTextNode(" ");
          node.insertAfter(space);
          space.select();
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  // Register OPEN_PAGE_LINK_MENU_COMMAND (triggered by slash command)
  useEffect(() => {
    return editor.registerCommand(
      OPEN_PAGE_LINK_MENU_COMMAND,
      () => {
        setIsOpen(true);
        setQuery("");
        matchStartRef.current = null;
        matchNodeKeyRef.current = null;
        setIsSlashCommandMode(true);

        // Position the menu at the current selection, then focus the search input
        requestAnimationFrame(() => {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            setAnchorRect(range.getBoundingClientRect());
          }
          // Focus the search input after the portal renders
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
          });
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  // Search pages when query changes
  useEffect(() => {
    if (!isOpen || !workspaceId) {
      return;
    }

    let cancelled = false;

    async function search() {
      const supabase = await getClient();
      let queryBuilder = supabase
        .from("pages")
        .select("id, title, icon")
        .eq("workspace_id", workspaceId!)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike("title", `%${query.trim()}%`);
      }

      const { data } = await queryBuilder;
      if (!cancelled) {
        setResults(data ?? []);
        setSelectedIndex(0);
      }
    }

    const timer = setTimeout(search, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, workspaceId]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    matchStartRef.current = null;
    matchNodeKeyRef.current = null;
    setIsSlashCommandMode(false);
  }, []);

  // Insert the selected page link and clean up the [[ trigger text
  const insertPageLink = useCallback(
    (page: PageResult) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if ($isTextNode(anchorNode) && matchStartRef.current !== null) {
          const text = anchorNode.getTextContent();
          const before = text.slice(0, matchStartRef.current);
          const after = text.slice(anchor.offset);

          anchorNode.setTextContent(before + after);
          anchorNode.select(before.length, before.length);

          const linkNode = $createPageLinkNode({ pageId: page.id });
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            sel.insertNodes([linkNode]);
            const space = $createTextNode(" ");
            linkNode.insertAfter(space);
            space.select();
          }
        }
      });

      closeMenu();
    },
    [editor, closeMenu],
  );

  // Insert from slash command context (no trigger text to remove)
  const insertFromSlashCommand = useCallback(
    (page: PageResult) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const linkNode = $createPageLinkNode({ pageId: page.id });
          selection.insertNodes([linkNode]);
          const space = $createTextNode(" ");
          linkNode.insertAfter(space);
          space.select();
        }
      });

      closeMenu();
    },
    [editor, closeMenu],
  );

  // Detect `[[` trigger in text updates
  useEffect(() => {
    return editor.registerTextContentListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if (!$isTextNode(anchorNode)) return;

        const text = anchorNode.getTextContent();
        const offset = anchor.offset;

        const textBeforeCursor = text.slice(0, offset);
        const triggerIndex = textBeforeCursor.lastIndexOf("[[");

        if (triggerIndex !== -1) {
          const textAfterTrigger = textBeforeCursor.slice(triggerIndex + 2);
          if (!textAfterTrigger.includes("]]")) {
            matchStartRef.current = triggerIndex;
            matchNodeKeyRef.current = anchorNode.getKey();
            setIsSlashCommandMode(false);
            setQuery(textAfterTrigger);
            setIsOpen(true);

            requestAnimationFrame(() => {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                setAnchorRect(range.getBoundingClientRect());
              }
            });
            return;
          }
        }

        // If we were open from [[ trigger and the trigger is gone, close
        if (isOpen && matchStartRef.current !== null) {
          closeMenu();
        }
      });
    });
  }, [editor, isOpen, closeMenu]);

  // Keyboard navigation when menu is open
  useEffect(() => {
    if (!isOpen) return;

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0,
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1,
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (results[selectedIndex]) {
          event?.preventDefault();
          if (matchStartRef.current !== null) {
            insertPageLink(results[selectedIndex]);
          } else {
            insertFromSlashCommand(results[selectedIndex]);
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (results[selectedIndex]) {
          event.preventDefault();
          if (matchStartRef.current !== null) {
            insertPageLink(results[selectedIndex]);
          } else {
            insertFromSlashCommand(results[selectedIndex]);
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        closeMenu();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removeDown();
      removeUp();
      removeEnter();
      removeTab();
      removeEscape();
    };
  }, [
    editor,
    isOpen,
    results,
    selectedIndex,
    insertPageLink,
    insertFromSlashCommand,
    closeMenu,
  ]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, closeMenu]);

  // Handle keyboard events on the search input (slash command mode)
  const handleSearchInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        case "Enter":
        case "Tab":
          if (results[selectedIndex]) {
            e.preventDefault();
            insertFromSlashCommand(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeMenu();
          editor.focus();
          break;
      }
    },
    [results, selectedIndex, insertFromSlashCommand, closeMenu, editor],
  );

  if (!isOpen || !anchorRect) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-64 overflow-hidden rounded-sm border border-overlay-border bg-popover shadow-md"
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
      }}
    >
      <div className="flex items-center gap-2 border-b border-overlay-border px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            if (isSlashCommandMode) {
              setQuery(e.target.value);
            }
          }}
          onKeyDown={handleSearchInputKeyDown}
          placeholder="Search pages…"
          readOnly={!isSlashCommandMode}
          className="h-6 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search pages"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1">
        {results.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            {query.trim() ? "No pages found" : "No pages in workspace"}
          </div>
        )}
        {results.map((page, index) => (
          <button
            key={page.id}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
              selectedIndex === index
                ? "bg-overlay-active text-foreground"
                : "text-muted-foreground hover:bg-overlay-hover"
            }`}
            onClick={() => {
              if (matchStartRef.current !== null) {
                insertPageLink(page);
              } else {
                insertFromSlashCommand(page);
              }
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            role="option"
            aria-selected={selectedIndex === index}
          >
            {page.icon ? (
              <span className="shrink-0 text-sm">{page.icon}</span>
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium text-foreground">
              {page.title || "Untitled"}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
