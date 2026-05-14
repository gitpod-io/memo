"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import {
  readFileAsText,
  parseMarkdownToEditorState,
} from "@/components/editor/markdown-utils";

interface UseMarkdownImportOptions {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  /** Distinguishes where the import was triggered from in analytics. */
  source: string;
}

interface UseMarkdownImportReturn {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileInput: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useMarkdownImport({
  workspaceId,
  workspaceSlug,
  userId,
  source,
}: UseMarkdownImportOptions): UseMarkdownImportReturn {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerFileInput = useCallback(() => {
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
        toast.error(
          "Invalid file type. Please select a .md or .markdown file.",
          { duration: 8000 },
        );
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
          if (!isInsufficientPrivilegeError(error)) {
            captureSupabaseError(error, `markdown-import:${source}`);
          }
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
          metadata: { page_id: newPage.id, source },
        });

        router.push(`/${workspaceSlug}/${newPage.id}`);
        router.refresh();
      } catch (error) {
        captureSupabaseError(
          error instanceof Error ? error : new Error(String(error)),
          `markdown-import:${source}`,
        );
        toast.error("Failed to read or parse the markdown file", {
          duration: 8000,
        });
      }
    },
    [workspaceId, workspaceSlug, userId, source, router],
  );

  return { fileInputRef, triggerFileInput, handleFileChange };
}
