"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, History, Maximize2, MoreHorizontal, Star, StarOff, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import type { LexicalEditor } from "lexical";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportEditorToMarkdown,
  downloadMarkdown,
  readFileAsText,
  parseMarkdownToEditorState,
} from "@/components/editor/markdown-utils";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError, lazyCaptureException } from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import { duplicateDatabase } from "@/lib/database";
import { useFavorite } from "@/components/sidebar/favorites-section";
import { useSidebar } from "@/components/sidebar/sidebar-context";

interface PageMenuProps {
  pageId: string;
  pageTitle: string;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  isDatabase?: boolean;
  onVersionHistoryOpen?: () => void;
}

export function PageMenu({
  pageId,
  pageTitle,
  workspaceId,
  workspaceSlug,
  userId,
  editorRef,
  isDatabase = false,
  onVersionHistoryOpen,
}: PageMenuProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toggleFocusMode, isMac } = useSidebar();
  const { isFavorited, toggle: toggleFavorite } = useFavorite({
    workspaceId,
    userId,
    pageId,
  });

  const handleDuplicate = useCallback(async () => {
    const supabase = await getClient();

    // Fetch the source page to get content, icon, and parent_id
    const { data: sourcePage, error: fetchError } = await supabase
      .from("pages")
      .select("content, icon, parent_id, position")
      .eq("id", pageId)
      .single();

    if (fetchError || !sourcePage) {
      if (fetchError) captureSupabaseError(fetchError, "page-menu:duplicate-fetch");
      toast.error("Failed to duplicate page", { duration: 8000 });
      return;
    }

    // Find the next available position among siblings
    let siblingQuery = supabase
      .from("pages")
      .select("position")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (sourcePage.parent_id) {
      siblingQuery = siblingQuery.eq("parent_id", sourcePage.parent_id);
    } else {
      siblingQuery = siblingQuery.is("parent_id", null);
    }

    const { data: siblings } = await siblingQuery;
    const nextPosition = siblings && siblings.length > 0
      ? Math.max(...siblings.map((s) => s.position)) + 1
      : 0;

    const duplicateTitle = (pageTitle.trim() || "Untitled") + " (copy)";

    if (isDatabase) {
      const { data: newDbPage, error: dbError } = await duplicateDatabase(
        pageId,
        workspaceId,
        userId,
        duplicateTitle,
        sourcePage.parent_id,
        sourcePage.icon,
        nextPosition,
        sourcePage.content as Record<string, unknown> | null ?? null,
      );

      if (dbError || !newDbPage) {
        if (dbError) captureSupabaseError(dbError, "page-menu:duplicate-database");
        toast.error("Failed to duplicate database", { duration: 8000 });
        return;
      }

      toast.success("Database duplicated");
      router.push(`/${workspaceSlug}/${newDbPage.id}`);
      router.refresh();
      return;
    }

    const { data: newPage, error: insertError } = await supabase
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        parent_id: sourcePage.parent_id,
        title: duplicateTitle,
        content: sourcePage.content
          ? JSON.parse(JSON.stringify(sourcePage.content))
          : null,
        icon: sourcePage.icon,
        position: nextPosition,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertError) {
      captureSupabaseError(insertError, "page-menu:duplicate-insert");
      toast.error("Failed to duplicate page", { duration: 8000 });
      return;
    }
    if (!newPage) {
      toast.error("Failed to duplicate page", { duration: 8000 });
      return;
    }

    toast.success("Page duplicated");
    router.push(`/${workspaceSlug}/${newPage.id}`);
    router.refresh();
  }, [pageId, pageTitle, workspaceId, workspaceSlug, userId, isDatabase, router]);

  const handleExport = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      toast.error("Editor not ready", { duration: 8000 });
      return;
    }

    try {
      const markdown = exportEditorToMarkdown(editor);
      const filename = (pageTitle.trim() || "Untitled") + ".md";
      downloadMarkdown(markdown, filename);

      getClient().then((supabase) => {
        trackEventClient(supabase, "editor.export", userId, {
          workspaceId,
          metadata: { page_id: pageId },
        });
      }).catch(() => {
        // Client init failed — skip tracking silently
      });
    } catch (error) {
      lazyCaptureException(error);
      toast.error("Export failed", {
        duration: 8000,
      });
    }
  }, [editorRef, pageTitle, userId, workspaceId, pageId]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (!file) return;

      if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown")) {
        toast.error("Invalid file type. Please select a .md or .markdown file.", {
          duration: 8000,
        });
        return;
      }

      try {
        const markdown = await readFileAsText(file);
        const editorState = parseMarkdownToEditorState(markdown);

        // Derive page title from filename (strip extension)
        const importedTitle = file.name.replace(/\.(md|markdown)$/, "");

        const supabase = await getClient();

        // Count existing pages to determine position
        const { count } = await supabase
          .from("pages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null);

        const { data: newPage, error } = await supabase
          .from("pages")
          .insert({
            workspace_id: workspaceId,
            parent_id: null,
            title: importedTitle,
            content: editorState,
            position: count ?? 0,
            created_by: userId,
          })
          .select("id")
          .single();

        if (error) {
          captureSupabaseError(error, "page-menu:import-create-page");
          toast.error("Failed to create page from import", {
            duration: 8000,
          });
          return;
        }
        if (!newPage) {
          toast.error("Failed to create page from import", {
            duration: 8000,
          });
          return;
        }

        trackEventClient(supabase, "editor.import", userId, {
          workspaceId,
          metadata: { page_id: newPage.id },
        });

        router.push(`/${workspaceSlug}/${newPage.id}`);
        router.refresh();
      } catch (error) {
        captureSupabaseError(error instanceof Error ? error : new Error(String(error)), "page-menu:import");
        toast.error("Failed to read or parse the markdown file", {
          duration: 8000,
        });
      }
    },
    [workspaceId, workspaceSlug, userId, router]
  );

  // ⌘D / Ctrl+D — duplicate page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "d" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        // Skip when a text input, textarea, or contenteditable is focused
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
            return;
          }
        }
        e.preventDefault();
        handleDuplicate();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDuplicate]);

  // ⌘⇧E / Ctrl+Shift+E — export as Markdown
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "E" &&
        e.shiftKey &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey
      ) {
        // Skip when a text input, textarea, or contenteditable is focused
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
            return;
          }
        }
        e.preventDefault();
        handleExport();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Page actions" />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
          <DropdownMenuItem onClick={toggleFavorite}>
            {isFavorited ? (
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
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
            <span className="ml-auto text-xs text-muted-foreground">
              {isMac ? "⌘D" : "Ctrl+D"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onVersionHistoryOpen}>
            <History className="h-4 w-4" />
            Version history
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleFocusMode}>
            <Maximize2 className="h-4 w-4" />
            Focus mode
            <span className="ml-auto text-xs text-muted-foreground">
              {isMac ? "⌘⇧F" : "Ctrl+Shift+F"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export as Markdown
            <span className="ml-auto text-xs text-muted-foreground">
              {isMac ? "⌘⇧E" : "Ctrl+Shift+E"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="h-4 w-4" />
            Import Markdown
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Import markdown file"
      />
    </>
  );
}
