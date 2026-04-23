"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { Input } from "@/components/ui/input";
import { getClient } from "@/lib/supabase/lazy-client";
import type { RendererProps, EditorProps } from "./index";

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function getPageIds(value: Record<string, unknown>): string[] {
  if (Array.isArray(value.page_ids)) {
    return value.page_ids.filter(
      (id): id is string => typeof id === "string",
    );
  }
  return [];
}

function getTargetDatabaseId(
  config: Record<string, unknown>,
): string | null {
  return typeof config.database_id === "string" ? config.database_id : null;
}

// ---------------------------------------------------------------------------
// Linked page data
// ---------------------------------------------------------------------------

interface LinkedPage {
  id: string;
  title: string;
  icon: string | null;
  deleted?: boolean;
}

// ---------------------------------------------------------------------------
// RelationPill — a single linked page pill (matches PageLinkNode styling)
// ---------------------------------------------------------------------------

function RelationPill({
  page,
  onClick,
}: {
  page: LinkedPage;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (page.deleted) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground line-through align-baseline">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Deleted page
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-[160px] items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-foreground hover:bg-overlay-active align-baseline cursor-pointer"
      title={page.title}
      aria-label={`Navigate to ${page.title || "Untitled"}`}
    >
      {page.icon ? (
        <span className="shrink-0 text-sm">{page.icon}</span>
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate underline decoration-muted-foreground/50 underline-offset-2">
        {page.title || "Untitled"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// useLinkedPages — resolve page IDs to page data
// ---------------------------------------------------------------------------

function useLinkedPages(pageIds: string[]): {
  pages: LinkedPage[];
  loading: boolean;
} {
  const idsKey = pageIds.join(",");
  const hasIds = idsKey !== "";

  // Start loading when there are IDs to resolve; avoids synchronous
  // setState inside the effect body (react-hooks/set-state-in-effect).
  const [pages, setPages] = useState<LinkedPage[]>([]);
  const [loading, setLoading] = useState(hasIds);

  useEffect(() => {
    if (!hasIds) {
      return;
    }

    let cancelled = false;

    const ids = idsKey.split(",");

    async function resolve() {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, icon")
        .in("id", ids);

      if (cancelled) return;

      if (error || !data) {
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "relation-renderer:resolve-pages");
        }
        setPages(
          ids.map((id) => ({ id, title: "", icon: null, deleted: true })),
        );
      } else {
        const resolved = new Map(
          data.map((p: { id: string; title: string; icon: string | null }) => [
            p.id,
            { id: p.id, title: p.title || "Untitled", icon: p.icon },
          ]),
        );
        setPages(
          ids.map(
            (id) =>
              resolved.get(id) ?? {
                id,
                title: "",
                icon: null,
                deleted: true,
              },
          ),
        );
      }
      setLoading(false);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [hasIds, idsKey]);

  return { pages, loading };
}

// ---------------------------------------------------------------------------
// RelationRenderer
// ---------------------------------------------------------------------------

export function RelationRenderer({ value }: RendererProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const pageIds = getPageIds(value);
  const { pages, loading } = useLinkedPages(pageIds);

  if (pageIds.length === 0) return null;

  if (loading) {
    return (
      <div className="flex flex-wrap gap-1">
        {pageIds.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-sm text-muted-foreground align-baseline"
          >
            <span className="inline-block h-3.5 w-16 animate-pulse bg-overlay-active" />
          </span>
        ))}
      </div>
    );
  }

  const handlePillClick = (pageId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const slug = params.workspaceSlug ?? "";
    router.push(`/${slug}/${pageId}`);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {pages.map((page) => (
        <RelationPill
          key={page.id}
          page={page}
          onClick={page.deleted ? undefined : handlePillClick(page.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target database row for the search dropdown
// ---------------------------------------------------------------------------

interface TargetRow {
  id: string;
  title: string;
  icon: string | null;
}

// ---------------------------------------------------------------------------
// RelationEditor
// ---------------------------------------------------------------------------

export function RelationEditor({
  value,
  property,
  onChange,
  onBlur,
}: EditorProps) {
  const [query, setQuery] = useState("");
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = getPageIds(value);
  const targetDatabaseId = getTargetDatabaseId(property.config);

  const hasTarget = targetDatabaseId !== null;

  // Start loading when a target database is configured; avoids synchronous
  // setState inside the effect body (react-hooks/set-state-in-effect).
  const [loadingRows, setLoadingRows] = useState(hasTarget);

  // Load rows from the target database
  useEffect(() => {
    if (!hasTarget || !targetDatabaseId) {
      return;
    }

    let cancelled = false;

    async function loadTargetRows() {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, icon")
        .eq("parent_id", targetDatabaseId)
        .is("deleted_at", null)
        .order("position");

      if (cancelled) return;

      if (error || !data) {
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "relation-editor:load-target-rows");
        }
        setTargetRows([]);
      } else {
        setTargetRows(
          data.map(
            (r: { id: string; title: string; icon: string | null }) => ({
              id: r.id,
              title: r.title || "Untitled",
              icon: r.icon,
            }),
          ),
        );
      }
      setLoadingRows(false);
    }

    void loadTargetRows();
    return () => {
      cancelled = true;
    };
  }, [hasTarget, targetDatabaseId]);

  // Auto-focus the search input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        onBlur();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onBlur]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const trimmed = query.trim().toLowerCase();
  const filtered = targetRows.filter((row) =>
    row.title.toLowerCase().includes(trimmed),
  );

  const handleToggle = useCallback(
    (rowId: string) => {
      let newIds: string[];
      if (selectedSet.has(rowId)) {
        newIds = selectedIds.filter((id) => id !== rowId);
      } else {
        newIds = [...selectedIds, rowId];
      }
      onChange({ page_ids: newIds });
    },
    [selectedIds, selectedSet, onChange],
  );

  if (!targetDatabaseId) {
    return (
      <div className="w-56 rounded-sm border border-border bg-background p-3 shadow-md">
        <p className="text-xs text-muted-foreground">
          No target database configured for this relation property.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-56 rounded-sm border border-border bg-background shadow-md"
    >
      <div className="p-1.5">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onBlur();
            }
          }}
          placeholder="Search pages…"
          className="h-7 text-xs"
        />
      </div>
      <div className="max-h-48 overflow-y-auto px-1 pb-1">
        {loadingRows ? (
          <div className="space-y-1 px-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-5 animate-pulse bg-overlay-border"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {trimmed ? "No matching pages" : "No rows in target database"}
          </p>
        ) : (
          filtered.map((row) => {
            const isSelected = selectedSet.has(row.id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => handleToggle(row.id)}
                aria-label={`${isSelected ? "Remove" : "Add"} ${row.title}`}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1 text-sm",
                  "hover:bg-overlay-hover",
                )}
              >
                {row.icon ? (
                  <span className="shrink-0 text-sm">{row.icon}</span>
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-left text-sm">
                  {row.title}
                </span>
                {isSelected && (
                  <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
