"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Download,
  FileText,
  Maximize2,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  Table2,
  Upload,
  Users,
} from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { useWorkspace } from "@/components/sidebar/workspace-context";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { useTheme } from "@/lib/theme";
import { useMarkdownImport } from "@/lib/use-markdown-import";
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
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildBreadcrumbMap, getParentBreadcrumb } from "@/lib/breadcrumb";
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

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  /** When true, the action is only shown when on a page route. */
  requiresPage?: boolean;
}

/**
 * Extract the pageId from the current pathname.
 * URL pattern: /{workspaceSlug}/{pageId} where pageId is a UUID.
 */
function extractPageId(pathname: string): string | null {
  const match = pathname.match(
    /^\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  return match ? match[1] : null;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { workspaceId, workspaceSlug } = useWorkspace();
  const { toggle: toggleSidebar, toggleFocusMode, isMac } = useSidebar();
  const { resolved: resolvedTheme, setPreference: setThemePreference } =
    useTheme();
  const currentPageId = extractPageId(pathname);

  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisitItem[]>([]);
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setQuery("");
      }
    },
    [onOpenChange],
  );

  // Fetch pages and recent visits when the palette opens
  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;

    async function fetchData() {
      const supabase = await getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const fetchedUserId = user?.id;

      if (!cancelled && fetchedUserId) {
        setUserId(fetchedUserId);
      }

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
      if (fetchedUserId) {
        const { data: visitData, error: visitError } =
          await retryOnNetworkError(async () => {
            const s = await getClient();
            return pageVisitsWithPages(s)
              .eq("workspace_id", workspaceId)
              .eq("user_id", fetchedUserId)
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

  // Markdown import hook for the "Import Markdown" action
  const {
    fileInputRef: importRef,
    triggerFileInput: triggerImport,
    handleFileChange: handleImportFileChange,
  } = useMarkdownImport({
    workspaceId: workspaceId ?? "",
    workspaceSlug: workspaceSlug ?? "",
    userId: userId ?? "",
    source: "command-palette",
  });

  const mod = isMac ? "⌘" : "Ctrl+";

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      {
        id: "new-page",
        label: "New Page",
        icon: <Plus className="h-4 w-4 text-muted-foreground" />,
        shortcut: `${mod}N`,
        onSelect: () => {
          handleOpenChange(false);
          // Dispatch ⌘+N to trigger the existing new page shortcut handler
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "n",
              code: "KeyN",
              metaKey: true,
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
      },
      {
        id: "new-database",
        label: "New Database",
        icon: <Table2 className="h-4 w-4 text-muted-foreground" />,
        onSelect: () => {
          handleOpenChange(false);
          // Click the sidebar "New Database" button programmatically
          const btn = document.querySelector<HTMLButtonElement>(
            '[data-testid="sb-new-database-btn"]',
          );
          if (btn) {
            btn.click();
          }
        },
      },
      {
        id: "export-markdown",
        label: "Export as Markdown",
        icon: <Download className="h-4 w-4 text-muted-foreground" />,
        shortcut: `${mod}⇧E`,
        requiresPage: true,
        onSelect: () => {
          handleOpenChange(false);
          // Dispatch ⌘+Shift+E to trigger the existing export shortcut handler
          requestAnimationFrame(() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "E",
                code: "KeyE",
                metaKey: true,
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
              }),
            );
          });
        },
      },
      {
        id: "import-markdown",
        label: "Import Markdown",
        icon: <Upload className="h-4 w-4 text-muted-foreground" />,
        onSelect: () => {
          handleOpenChange(false);
          // Delay to allow dialog to close before file picker opens
          requestAnimationFrame(() => {
            triggerImport();
          });
        },
      },
      {
        id: "workspace-settings",
        label: "Workspace Settings",
        icon: <Settings className="h-4 w-4 text-muted-foreground" />,
        onSelect: () => {
          if (!workspaceSlug) return;
          router.push(`/${workspaceSlug}/settings`);
          handleOpenChange(false);
        },
      },
      {
        id: "members",
        label: "Members",
        icon: <Users className="h-4 w-4 text-muted-foreground" />,
        onSelect: () => {
          if (!workspaceSlug) return;
          router.push(`/${workspaceSlug}/settings/members`);
          handleOpenChange(false);
        },
      },
      {
        id: "toggle-theme",
        label:
          resolvedTheme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode",
        icon:
          resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ),
        onSelect: () => {
          setThemePreference(resolvedTheme === "dark" ? "light" : "dark");
          handleOpenChange(false);
        },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        icon: <PanelLeft className="h-4 w-4 text-muted-foreground" />,
        shortcut: `${mod}\\`,
        onSelect: () => {
          toggleSidebar();
          handleOpenChange(false);
        },
      },
      {
        id: "toggle-focus-mode",
        label: "Toggle Focus Mode",
        icon: <Maximize2 className="h-4 w-4 text-muted-foreground" />,
        shortcut: `${mod}⇧F`,
        onSelect: () => {
          toggleFocusMode();
          handleOpenChange(false);
        },
      },
    ];

    return actions;
  }, [
    mod,
    resolvedTheme,
    workspaceSlug,
    handleOpenChange,
    toggleSidebar,
    toggleFocusMode,
    setThemePreference,
    triggerImport,
    router,
  ]);

  // Filter actions based on context (page-dependent actions)
  const visibleActions = useMemo(
    () =>
      quickActions.filter(
        (action) => !action.requiresPage || currentPageId !== null,
      ),
    [quickActions, currentPageId],
  );

  const hasQuery = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Command palette</DialogTitle>
        <DialogDescription>
          Search for a page or run a quick action
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
            placeholder={`Search pages… ${isMac ? "⌘" : "Ctrl+"}P`}
            value={query}
            onValueChange={setQuery}
            data-testid="command-palette-input"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Quick Actions — shown when no query or when query matches */}
            {!hasQuery && visibleActions.length > 0 && (
              <CommandGroup heading="Quick Actions">
                {visibleActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.label}
                    onSelect={action.onSelect}
                    data-testid={`command-palette-action-${action.id}`}
                  >
                    {action.icon}
                    <span className="flex-1 truncate">{action.label}</span>
                    {action.shortcut && (
                      <CommandShortcut>{action.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

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
              <>
                {/* Show matching actions when searching */}
                <CommandGroup heading="Quick Actions">
                  {visibleActions.map((action) => (
                    <CommandItem
                      key={action.id}
                      value={action.label}
                      onSelect={action.onSelect}
                      data-testid={`command-palette-action-${action.id}`}
                    >
                      {action.icon}
                      <span className="flex-1 truncate">{action.label}</span>
                      {action.shortcut && (
                        <CommandShortcut>{action.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>

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
              </>
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

        {/* Hidden file input for markdown import */}
        <input
          ref={importRef}
          type="file"
          accept=".md,.markdown"
          className="hidden"
          onChange={handleImportFileChange}
          data-testid="command-palette-import-input"
        />
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
