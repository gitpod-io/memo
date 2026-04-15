"use client";

import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface WorkspaceHomeProps {
  workspace: { id: string; name: string; slug: string };
  pages: {
    id: string;
    title: string;
    icon: string | null;
    updated_at: string;
  }[];
  userId: string;
}

export function WorkspaceHome({
  workspace,
  pages,
  userId,
}: WorkspaceHomeProps) {
  const router = useRouter();

  async function handleCreatePage() {
    const supabase = createClient();
    const { data: newPage, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: workspace.id,
        parent_id: null,
        title: "",
        position: pages.length,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !newPage) return;

    router.push(`/${workspace.slug}/${newPage.id}`);
    router.refresh();
  }

  if (pages.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-medium">No pages yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first page to start writing. Pages can be nested to
            organize your workspace.
          </p>
          <Button onClick={handleCreatePage}>
            <Plus className="h-4 w-4" />
            Create first page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <Button size="sm" onClick={handleCreatePage}>
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-0.5">
        {pages.map((page) => (
          <button
            key={page.id}
            className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.04]"
            onClick={() => router.push(`/${workspace.slug}/${page.id}`)}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {page.icon ? (
                <span className="text-sm">{page.icon}</span>
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="flex-1 truncate">
              {page.title || "Untitled"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(page.updated_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
