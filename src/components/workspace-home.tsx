"use client";

import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import type { RecentPageVisit } from "@/lib/types";

interface WorkspaceHomeProps {
  workspace: { id: string; name: string; slug: string };
  pages: {
    id: string;
    title: string;
    icon: string | null;
    updated_at: string;
  }[];
  userId: string;
  recentVisits?: RecentPageVisit[];
}

export function WorkspaceHome({
  workspace,
  pages,
  userId,
  recentVisits = [],
}: WorkspaceHomeProps) {
  const router = useRouter();

  async function handleCreatePage() {
    const supabase = await getClient();
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

    if (error) {
      captureSupabaseError(error, "workspace-home:create-page");
      toast.error("Failed to create page", { duration: 8000 });
      return;
    }
    if (!newPage) return;

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
      {recentVisits.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-white/30">
            Recently Visited
          </h2>
          <div className="flex flex-col gap-0.5">
            {recentVisits.map((visit) => (
              <button
                key={visit.page_id}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.04]"
                onClick={() =>
                  router.push(`/${workspace.slug}/${visit.page_id}`)
                }
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {visit.icon ? (
                    <span className="text-sm">{visit.icon}</span>
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="flex-1 truncate">
                  {visit.title || "Untitled"}
                </span>
                <RelativeTime
                  dateStr={visit.visited_at}
                  className="text-xs text-muted-foreground"
                />
              </button>
            ))}
          </div>
        </div>
      )}
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
            <RelativeTime
              dateStr={page.updated_at}
              className="text-xs text-muted-foreground"
            />
          </button>
        ))}
      </div>
    </div>
  );
}


