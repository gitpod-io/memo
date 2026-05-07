"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Table2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RelativeTime } from "@/components/relative-time";
import type { RecentPageVisit } from "@/lib/types";

type SortOption =
  | "updated_desc"
  | "title_asc"
  | "title_desc"
  | "created_desc"
  | "created_asc";

const SORT_LABELS: Record<SortOption, string> = {
  updated_desc: "Last modified",
  title_asc: "Title A-Z",
  title_desc: "Title Z-A",
  created_desc: "Date created (newest)",
  created_asc: "Date created (oldest)",
};

interface WorkspaceHomeProps {
  workspace: { id: string; name: string; slug: string };
  pages: {
    id: string;
    title: string;
    icon: string | null;
    is_database: boolean;
    created_at: string;
    updated_at: string;
  }[];
  userId: string;
  recentVisits?: RecentPageVisit[];
}

function sortPages(
  pages: WorkspaceHomeProps["pages"],
  sort: SortOption,
): WorkspaceHomeProps["pages"] {
  return [...pages].sort((a, b) => {
    switch (sort) {
      case "updated_desc":
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      case "title_asc": {
        const aTitle = a.title || "Untitled";
        const bTitle = b.title || "Untitled";
        return aTitle.localeCompare(bTitle);
      }
      case "title_desc": {
        const aTitle = a.title || "Untitled";
        const bTitle = b.title || "Untitled";
        return bTitle.localeCompare(aTitle);
      }
      case "created_desc":
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "created_asc":
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }
  });
}

export function WorkspaceHome({
  workspace,
  pages,
  userId,
  recentVisits = [],
}: WorkspaceHomeProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [filter, setFilter] = useState("");

  const filteredAndSorted = useMemo(() => {
    const trimmed = filter.trim().toLowerCase();
    const filtered = trimmed
      ? pages.filter((p) => {
          const title = p.title || "Untitled";
          return title.toLowerCase().includes(trimmed);
        })
      : pages;
    return sortPages(filtered, sortBy);
  }, [pages, filter, sortBy]);

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
      if (
        !isSchemaNotFoundError(error) &&
        !isInsufficientPrivilegeError(error)
      ) {
        captureSupabaseError(error, "workspace-home:create-page");
      }
      toast.error("Failed to create page", { duration: 8000 });
      return;
    }
    if (!newPage) return;

    trackEventClient(supabase, "page.created", userId, {
      workspaceId: workspace.id,
      metadata: { page_id: newPage.id, source: "workspace-home" },
    });

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
          <h2 className="mb-2 text-xs uppercase tracking-widest text-label-faint">
            Recently Visited
          </h2>
          <div className="flex flex-col gap-0.5">
            {recentVisits.map((visit) => (
              <button
                key={visit.page_id}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-overlay-hover"
                onClick={() =>
                  router.push(`/${workspace.slug}/${visit.page_id}`)
                }
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {visit.icon ? (
                    <span className="text-sm">{visit.icon}</span>
                  ) : visit.is_database ? (
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="flex-1 truncate" title={visit.title || "Untitled"}>
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
      <div className="mt-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-label-faint">
          All Pages
        </h2>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter pages…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8"
              aria-label="Filter pages by title"
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <SelectTrigger
              size="sm"
              className="w-auto shrink-0"
              aria-label="Sort pages"
            >
              <SelectValue>
                {(value: string) => SORT_LABELS[value as SortOption] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        {filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No matches</h3>
            <p className="text-sm text-muted-foreground">
              No pages match your filter
            </p>
            <Button variant="outline" size="sm" onClick={() => setFilter("")}>
              Clear filter
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredAndSorted.map((page) => (
              <button
                key={page.id}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-overlay-hover"
                onClick={() =>
                  router.push(`/${workspace.slug}/${page.id}`)
                }
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {page.icon ? (
                    <span className="text-sm">{page.icon}</span>
                  ) : page.is_database ? (
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="flex-1 truncate" title={page.title || "Untitled"}>
                  {page.title || "Untitled"}
                </span>
                <RelativeTime
                  dateStr={page.updated_at}
                  className="text-xs text-muted-foreground"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
