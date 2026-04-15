"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
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
import { createClient } from "@/lib/supabase/client";

interface PageMenuProps {
  pageId: string;
  pageTitle: string;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}

export function PageMenu({
  pageTitle,
  workspaceId,
  workspaceSlug,
  userId,
  editorRef,
}: PageMenuProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    try {
      const markdown = exportEditorToMarkdown(editor);
      const filename = (pageTitle.trim() || "Untitled") + ".md";
      downloadMarkdown(markdown, filename);
    } catch (error) {
      toast.error("Export failed", {
        duration: 8000,
      });
      console.error("Markdown export error:", error);
    }
  }, [editorRef, pageTitle]);

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

        const supabase = createClient();

        // Count existing pages to determine position
        const { count } = await supabase
          .from("pages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);

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

        if (error || !newPage) {
          toast.error("Failed to create page from import", {
            duration: 8000,
          });
          console.error("Import error:", error);
          return;
        }

        router.push(`/${workspaceSlug}/${newPage.id}`);
        router.refresh();
      } catch (error) {
        toast.error("Failed to read or parse the markdown file", {
          duration: 8000,
        });
        console.error("Import error:", error);
      }
    },
    [workspaceId, workspaceSlug, userId, router]
  );

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
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export as Markdown
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
