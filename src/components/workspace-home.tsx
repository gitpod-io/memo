"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Table2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { createDatabase } from "@/lib/database";
import { trackEventClient } from "@/lib/track-event";
import { useMarkdownImport } from "@/lib/use-markdown-import";
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
    child_count: number;
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
  const {
    fileInputRef,
    triggerFileInput: handleImportMarkdown,
    handleFileChange: handleImportFileChange,
  } = useMarkdownImport({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId,
    source: "workspace-home",
  });

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

  async function handleCreateDatabase() {
    const { data, error } = await createDatabase(workspace.id, userId);

    if (error || !data) {
      if (error && !isInsufficientPrivilegeError(error)) {
        captureSupabaseError(error, "workspace-home:create-database");
      }
      toast.error("Failed to create database", { duration: 8000 });
      return;
    }

    const supabase = await getClient();
    trackEventClient(supabase, "database.created", userId, {
      workspaceId: workspace.id,
      metadata: { page_id: data.page.id, source: "workspace-home" },
    });

    router.push(`/${workspace.slug}/${data.page.id}`);
    router.refresh();
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md,.markdown"
      className="hidden"
      onChange={handleImportFileChange}
      aria-label="Import markdown file"
      data-testid="wh-import-file-input"
    />
  );

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
          <Button variant="outline" size="sm" onClick={handleImportMarkdown} data-testid="wh-import-markdown-btn">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import Markdown</span>
            <span className="sm:hidden">Import</span>
          </Button>
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="wh-header">
        <h1 className="min-w-0 text-2xl font-semibold">{workspace.name}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleImportMarkdown} data-testid="wh-import-markdown-btn">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import Markdown</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleCreateDatabase} data-testid="wh-new-database-btn">
            <Table2 className="h-4 w-4" />
            <span className="hidden sm:inline">New Database</span>
            <span className="sm:hidden">Database</span>
          </Button>
          <Button size="sm" onClick={handleCreatePage} data-testid="wh-new-page-btn">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Page</span>
            <span className="sm:hidden">Page</span>
          </Button>
        </div>
      </div>
      {recentVisits.length > 0 && (
        <div className="mt-6" data-testid="wh-recently-visited">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-label-faint">
            Recently Visited
          </h2>
          <div className="flex flex-col gap-0.5">
            {recentVisits.map((visit) => (
              <button
                key={visit.page_id}
                data-testid={`wh-recent-item-${visit.page_id}`}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm transition-none hover:bg-overlay-hover focus-visible:bg-overlay-active focus-visible:outline-none"
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
                {visit.is_database ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Database
                  </span>
                ) : visit.child_count > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {visit.child_count} sub-page{visit.child_count !== 1 ? "s" : ""}
                  </span>
                ) : null}
                <RelativeTime
                  dateStr={visit.visited_at}
                  className="shrink-0 text-xs text-muted-foreground"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6" data-testid="wh-all-pages">
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
              data-testid="wh-filter-input"
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
              data-testid="wh-sort-dropdown"
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
                data-testid={`wh-page-item-${page.id}`}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm transition-none hover:bg-overlay-hover focus-visible:bg-overlay-active focus-visible:outline-none"
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
                {page.is_database ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Database
                  </span>
                ) : page.child_count > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {page.child_count} sub-page{page.child_count !== 1 ? "s" : ""}
                  </span>
                ) : null}
                <RelativeTime
                  dateStr={page.updated_at}
                  className="shrink-0 text-xs text-muted-foreground"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      {fileInput}
    </div>
  );
}
