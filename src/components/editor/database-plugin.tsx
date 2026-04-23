"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  createCommand,
  type LexicalCommand,
} from "lexical";
import { Plus, Search, Table2 } from "lucide-react";
import { lazyCaptureException } from "@/lib/capture";
import {
  $createDatabaseNode,
  DatabaseNode,
} from "@/components/editor/database-node";
import { getClient } from "@/lib/supabase/lazy-client";
import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const INSERT_DATABASE_COMMAND: LexicalCommand<{
  databaseId: string;
  viewId: string | null;
}> = createCommand("INSERT_DATABASE_COMMAND");

export const OPEN_DATABASE_MENU_COMMAND: LexicalCommand<void> = createCommand(
  "OPEN_DATABASE_MENU_COMMAND",
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatabaseResult {
  id: string;
  title: string;
  icon: string | null;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function DatabasePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const params = useParams<{ workspaceSlug?: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DatabaseResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Resolve workspace slug to ID and get current user
  useEffect(() => {
    if (!params.workspaceSlug) return;
    let cancelled = false;

    async function resolve() {
      const supabase = await getClient();
      const [workspaceResult, userResult] = await Promise.all([
        supabase
          .from("workspaces")
          .select("id")
          .eq("slug", params.workspaceSlug!)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (!cancelled) {
        if (workspaceResult.data) setWorkspaceId(workspaceResult.data.id);
        if (userResult.data?.user) setUserId(userResult.data.user.id);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [params.workspaceSlug]);

  // Verify DatabaseNode is registered
  useEffect(() => {
    if (!editor.hasNodes([DatabaseNode])) {
      throw new Error(
        "DatabasePlugin: DatabaseNode not registered on editor. Add it to initialConfig.nodes.",
      );
    }
  }, [editor]);

  // Register INSERT_DATABASE_COMMAND
  useEffect(() => {
    return editor.registerCommand(
      INSERT_DATABASE_COMMAND,
      (payload) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = $createDatabaseNode({
            databaseId: payload.databaseId,
            viewId: payload.viewId,
          });
          selection.insertNodes([node]);
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  // Register OPEN_DATABASE_MENU_COMMAND
  useEffect(() => {
    return editor.registerCommand(
      OPEN_DATABASE_MENU_COMMAND,
      () => {
        setIsOpen(true);
        setQuery("");
        setResults([]);
        setSelectedIndex(0);

        requestAnimationFrame(() => {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            setAnchorRect(range.getBoundingClientRect());
          }
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
          });
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  // Search databases when query changes
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    let cancelled = false;

    async function search() {
      const supabase = await getClient();
      let queryBuilder = supabase
        .from("pages")
        .select("id, title, icon")
        .eq("workspace_id", workspaceId!)
        .eq("is_database", true)
        .is("deleted_at", null)
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
    setCreating(false);
  }, []);

  // Insert an existing database
  const insertDatabase = useCallback(
    (db: DatabaseResult) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = $createDatabaseNode({
            databaseId: db.id,
            viewId: null,
          });
          selection.insertNodes([node]);
        }
      });
      closeMenu();
    },
    [editor, closeMenu],
  );

  // Create a new database and insert it
  const createAndInsert = useCallback(async () => {
    if (!workspaceId || !userId || creating) return;
    setCreating(true);

    try {
      // Dynamic import to avoid pulling database.ts into the editor bundle
      const { createDatabase } = await import("@/lib/database");
      const { data, error } = await createDatabase(workspaceId, userId);

      if (error || !data) {
        setCreating(false);
        return;
      }

      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = $createDatabaseNode({
            databaseId: data.page.id,
            viewId: data.view.id,
          });
          selection.insertNodes([node]);
        }
      });
      closeMenu();
    } catch (err) {
      lazyCaptureException(err);
      setCreating(false);
    }
  }, [workspaceId, userId, creating, editor, closeMenu]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event.preventDefault();
        // +1 for "Create new database" option
        const total = results.length + 1;
        setSelectedIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event.preventDefault();
        const total = results.length + 1;
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault();
        if (selectedIndex === 0) {
          createAndInsert();
        } else if (results[selectedIndex - 1]) {
          insertDatabase(results[selectedIndex - 1]);
        }
        return true;
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
      removeEscape();
    };
  }, [
    editor,
    isOpen,
    results,
    selectedIndex,
    insertDatabase,
    createAndInsert,
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

  // Handle keyboard events on the search input
  const handleSearchInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const total = results.length + 1;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (selectedIndex === 0) {
            createAndInsert();
          } else if (results[selectedIndex - 1]) {
            insertDatabase(results[selectedIndex - 1]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeMenu();
          editor.focus();
          break;
      }
    },
    [results, selectedIndex, insertDatabase, createAndInsert, closeMenu, editor],
  );

  if (!isOpen || !anchorRect) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-72 overflow-hidden rounded-sm border border-overlay-border bg-popover shadow-md"
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchInputKeyDown}
          placeholder="Search databases…"
          className="h-6 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search databases"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1">
        {/* Create new database option — always first */}
        <button
          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
            selectedIndex === 0
              ? "bg-overlay-active text-foreground"
              : "text-muted-foreground hover:bg-overlay-hover"
          }`}
          onClick={() => createAndInsert()}
          onMouseEnter={() => setSelectedIndex(0)}
          role="option"
          aria-selected={selectedIndex === 0}
          disabled={creating}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {creating ? "Creating…" : "Create new database"}
          </span>
        </button>

        {/* Existing databases */}
        {results.length === 0 && (
          <div className="px-2 py-2 text-center text-xs text-muted-foreground">
            {query.trim() ? "No databases found" : "No databases in workspace"}
          </div>
        )}
        {results.map((db, index) => (
          <button
            key={db.id}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
              selectedIndex === index + 1
                ? "bg-overlay-active text-foreground"
                : "text-muted-foreground hover:bg-overlay-hover"
            }`}
            onClick={() => insertDatabase(db)}
            onMouseEnter={() => setSelectedIndex(index + 1)}
            role="option"
            aria-selected={selectedIndex === index + 1}
          >
            {db.icon ? (
              <span className="shrink-0 text-sm">{db.icon}</span>
            ) : (
              <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium text-foreground">
              {db.title || "Untitled Database"}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
