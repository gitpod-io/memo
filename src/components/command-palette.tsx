"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Table2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import {
  pageVisitsWithPages,
  asPageVisitRows,
} from "@/lib/supabase/typed-queries";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SidebarPage } from "@/lib/types";

interface RecentVisitItem {
  page_id: string;
  title: string;
  icon: string | null;
  is_database: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Build a map from page ID to its parent title chain (e.g. "Parent → Child"). */
function buildBreadcrumbMap(pages: SidebarPage[]): Map<string, string> {
  const pageMap = new Map<string, SidebarPage>();
  for (const p of pages) {
    pageMap.set(p.id, p);
  }

  const cache = new Map<string, string>();

  function getPath(pageId: string): string {
    if (cache.has(pageId)) return cache.get(pageId)!;

    const page = pageMap.get(pageId);
    if (!page) return "";

    if (!page.parent_id || !pageMap.has(page.parent_id)) {
      const result = page.title || "Untitled";
      cache.set(pageId, result);
      return result;
    }

    const parentPath = getPath(page.parent_id);
    const result = `${parentPath} → ${page.title || "Untitled"}`;
    cache.set(pageId, result);
    return result;
  }

  for (const p of pages) {
    getPath(p.id);
  }

  return cache;
}

/** Get the parent breadcrumb for a page (everything except the page's own title). */
function getParentBreadcrumb(
  pageId: string,
  breadcrumbMap: Map<string, string>,
): string | null {
  const full = breadcrumbMap.get(pageId);
  if (!full) return null;
  const lastArrow = full.lastIndexOf(" → ");
  if (lastArrow === -1) return null;
  return full.substring(0, lastArrow);
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const workspaceSlug = params.workspaceSlug;

  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisitItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setQuery("");
      }
    },
    [onOpenChange],
  );

  // Resolve workspace slug to ID
  useEffect(() => {
    if (!workspaceSlug) return;

    let cancelled = false;

    retryOnNetworkError(async () => {
      const supabase = await getClient();
      return supabase
        .from("workspaces")
        .select("id")
        .eq("slug", workspaceSlug)
        .maybeSingle();
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        captureSupabaseError(error, "command-palette:workspace-lookup");
        return;
      }
      if (data) setWorkspaceId(data.id);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  // Fetch pages and recent visits when the palette opens
  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;

    async function fetchData() {
      const supabase = await getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;

      // Fetch all workspace pages (excluding trashed)
      const { data: pageData, error: pageError } = await retryOnNetworkError(
        async () => {
          const s = await getClient();
          return s
            .from("pages")
            .select(
              "id, workspace_id, parent_id, title, icon, cover_url, is_database, position, created_by, created_at, updated_at, deleted_at",
            )
            .eq("workspace_id", workspaceId)
            .is("deleted_at", null)
            .order("position", { ascending: true });
        },
      );

      if (cancelled) return;

      if (pageError) {
        if (!isInsufficientPrivilegeError(pageError)) {
          captureSupabaseError(pageError, "command-palette:fetch-pages");
        }
      } else if (pageData) {
        setPages(pageData);
      }

      // Fetch recent visits
      if (userId) {
        const { data: visitData, error: visitError } =
          await retryOnNetworkError(async () => {
            const s = await getClient();
            return pageVisitsWithPages(s)
              .eq("workspace_id", workspaceId)
              .eq("user_id", userId)
              .is("pages.deleted_at", null)
              .order("visited_at", { ascending: false })
              .limit(8);
          });

        if (cancelled) return;

        if (visitError) {
          if (!isSchemaNotFoundError(visitError)) {
            captureSupabaseError(visitError, "command-palette:fetch-visits");
          }
        } else if (visitData) {
          const visits = asPageVisitRows(visitData).map((row) => ({
            page_id: row.page_id,
            title: row.pages.title,
            icon: row.pages.icon,
            is_database: row.pages.is_database ?? false,
          }));
          setRecentVisits(visits);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const breadcrumbMap = useMemo(() => buildBreadcrumbMap(pages), [pages]);

  // Filter out database rows (children of is_database pages) for the page list
  const databaseIds = useMemo(
    () => new Set(pages.filter((p) => p.is_database).map((p) => p.id)),
    [pages],
  );

  const navigablePages = useMemo(
    () => pages.filter((p) => !p.parent_id || !databaseIds.has(p.parent_id)),
    [pages, databaseIds],
  );

  const handleSelect = useCallback(
    (pageId: string) => {
      if (!workspaceSlug) return;
      router.push(`/${workspaceSlug}/${pageId}`);
      handleOpenChange(false);
    },
    [workspaceSlug, router, handleOpenChange],
  );

  const hasQuery = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Command palette</DialogTitle>
        <DialogDescription>
          Search for a page to navigate to
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <Command
          className="rounded-none bg-popover"
          shouldFilter={hasQuery}
        >
          <CommandInput
            placeholder="Search pages…"
            value={query}
            onValueChange={setQuery}
            data-testid="command-palette-input"
          />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>

            {!hasQuery && recentVisits.length > 0 && (
              <CommandGroup heading="Recent">
                {recentVisits.map((visit) => (
                  <CommandItem
                    key={`recent-${visit.page_id}`}
                    value={visit.title || "Untitled"}
                    onSelect={() => handleSelect(visit.page_id)}
                    data-testid={`command-palette-recent-${visit.page_id}`}
                  >
                    <PageIcon
                      icon={visit.icon}
                      isDatabase={visit.is_database}
                    />
                    <span className="flex-1 truncate">
                      {visit.title || "Untitled"}
                    </span>
                    <ParentBreadcrumb
                      pageId={visit.page_id}
                      breadcrumbMap={breadcrumbMap}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasQuery && (
              <CommandGroup heading="Pages">
                {navigablePages.map((page) => (
                  <CommandItem
                    key={page.id}
                    value={`${page.title || "Untitled"} ${getParentBreadcrumb(page.id, breadcrumbMap) ?? ""}`}
                    onSelect={() => handleSelect(page.id)}
                    data-testid={`command-palette-page-${page.id}`}
                  >
                    <PageIcon
                      icon={page.icon}
                      isDatabase={page.is_database}
                    />
                    <span className="flex-1 truncate">
                      {page.title || "Untitled"}
                    </span>
                    <ParentBreadcrumb
                      pageId={page.id}
                      breadcrumbMap={breadcrumbMap}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!hasQuery && navigablePages.length > 0 && (
              <CommandGroup heading="All Pages">
                {navigablePages.map((page) => (
                  <CommandItem
                    key={page.id}
                    value={`${page.title || "Untitled"} ${getParentBreadcrumb(page.id, breadcrumbMap) ?? ""}`}
                    onSelect={() => handleSelect(page.id)}
                    data-testid={`command-palette-page-${page.id}`}
                  >
                    <PageIcon
                      icon={page.icon}
                      isDatabase={page.is_database}
                    />
                    <span className="flex-1 truncate">
                      {page.title || "Untitled"}
                    </span>
                    <ParentBreadcrumb
                      pageId={page.id}
                      breadcrumbMap={breadcrumbMap}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function PageIcon({
  icon,
  isDatabase,
}: {
  icon: string | null;
  isDatabase: boolean;
}) {
  if (icon) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-sm">
        {icon}
      </span>
    );
  }
  if (isDatabase) {
    return <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function ParentBreadcrumb({
  pageId,
  breadcrumbMap,
}: {
  pageId: string;
  breadcrumbMap: Map<string, string>;
}) {
  const parentPath = getParentBreadcrumb(pageId, breadcrumbMap);
  if (!parentPath) return null;

  return (
    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground max-w-[200px]">
      {parentPath}
    </span>
  );
}
