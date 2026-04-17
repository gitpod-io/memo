"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Search, X } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { captureSupabaseError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { useSidebar } from "@/components/sidebar/sidebar-context";

interface SearchResult {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  snippet: string;
  rank: number;
}

/**
 * Search display status — a single discriminated value replaces the
 * previous independent `loading` + `searched` booleans. This eliminates
 * the class of race conditions where the two flags get out of sync
 * (the root cause of issues #118, #126, #136, #144, #162).
 *
 * - "idle"    — no query entered or query was cleared
 * - "loading" — a search is in-flight (show skeleton placeholders)
 * - "done"    — the search completed (show results or empty state)
 */
type SearchStatus = "idle" | "loading" | "done";

export function PageSearch() {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const { registerSearchRef, isMac } = useSidebar();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceResolved, setWorkspaceResolved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Generation counter: incremented each search cycle so stale async
  // callbacks never update state. Immune to microtask ordering because
  // the counter is incremented synchronously before any async work.
  const searchGenRef = useRef(0);

  // Register the search input ref so the sidebar context can focus it via ⌘+K
  useEffect(() => {
    registerSearchRef(inputRef);
  }, [registerSearchRef]);

  // Resolve workspace slug to ID
  useEffect(() => {
    if (!params.workspaceSlug) {
      setWorkspaceId(null);
      setWorkspaceResolved(true);
      return;
    }

    setWorkspaceResolved(false);
    let cancelled = false;

    retryOnNetworkError(() => {
      const supabase = createClient();
      return supabase
        .from("workspaces")
        .select("id")
        .eq("slug", params.workspaceSlug)
        .maybeSingle();
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        captureSupabaseError(error, "page-search:workspace-lookup");
        setWorkspaceResolved(true);
        return;
      }
      setWorkspaceId(data?.id ?? null);
      setWorkspaceResolved(true);
    });

    return () => {
      cancelled = true;
    };
  }, [params.workspaceSlug]);

  const search = useCallback(
    async (q: string, gen: number, signal: AbortSignal) => {
      if (!q.trim() || !workspaceId) {
        if (searchGenRef.current === gen) {
          setResults([]);
          // Mark as done — the search resolved (even without a fetch).
          // The render logic uses `workspaceResolved` to decide whether
          // to show skeletons or the empty state.
          setSearchStatus("done");
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}&workspace_id=${encodeURIComponent(workspaceId)}`,
          { signal }
        );
        if (searchGenRef.current !== gen) return;
        if (response.ok) {
          const data = (await response.json()) as { results: SearchResult[] };
          if (searchGenRef.current !== gen) return;
          setResults(data.results);
          setSelectedIndex(0);
        } else {
          setResults([]);
        }
      } catch (error) {
        if (searchGenRef.current !== gen) return;
        // AbortErrors are expected when the user types quickly — only
        // capture genuine failures.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          Sentry.captureException(error);
        }
        setResults([]);
      } finally {
        if (searchGenRef.current === gen) {
          setSearchStatus("done");
        }
      }
    },
    [workspaceId]
  );

  // Debounced search with abort + generation counter.
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (!query.trim()) {
      searchGenRef.current += 1;
      setResults([]);
      setSearchStatus("idle");
      return;
    }

    const gen = ++searchGenRef.current;
    setSearchStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      search(query, gen, controller.signal);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      controller.abort();
    };
  }, [query, search]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // e.target can be a non-Node EventTarget (e.g. cross-origin iframe)
      const target = e.target;
      if (
        containerRef.current &&
        (!(target instanceof Node) ||
          !containerRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleNavigate(result: SearchResult) {
    if (!params.workspaceSlug) return;
    router.push(`/${params.workspaceSlug}/${result.id}`);
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearchStatus("idle");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          handleNavigate(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setSearchStatus("idle");
    setOpen(false);
    inputRef.current?.focus();
  }

  // Render snippet with highlighted matches (<<match>> markers from ts_headline)
  function renderSnippet(snippet: string) {
    const parts = snippet.split(/(<<|>>)/);
    const elements: React.ReactNode[] = [];
    let inHighlight = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "<<") {
        inHighlight = true;
        continue;
      }
      if (part === ">>") {
        inHighlight = false;
        continue;
      }
      if (part) {
        elements.push(
          inHighlight ? (
            <mark
              key={i}
              className="bg-accent/20 text-foreground rounded-none"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        );
      }
    }

    return elements;
  }

  const showResults = open && query.trim().length > 0;

  // Show skeletons when a search is in-flight, OR when the workspace
  // hasn't resolved yet (so we can't search). The `searchStatus === "done"`
  // check with `!workspaceResolved` handles the case where the search
  // callback returned early because workspaceId was null — we still want
  // skeletons until the workspace resolves and a real search can fire.
  const showSkeleton =
    results.length === 0 &&
    (searchStatus === "loading" ||
      (!workspaceResolved && searchStatus !== "idle"));

  // Show empty state only when the search completed AND the workspace
  // is resolved (so we know the empty result is real, not just because
  // we couldn't search yet).
  const showEmpty =
    searchStatus === "done" &&
    workspaceResolved &&
    results.length === 0 &&
    query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative px-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={`Search… ${isMac ? "⌘K" : "Ctrl+K"}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-7 border-white/[0.06] bg-transparent pl-7 pr-7 text-sm placeholder:text-muted-foreground"
          aria-label="Search pages"
          aria-expanded={showResults}
          role="combobox"
          aria-controls="search-results"
          aria-activedescendant={
            showResults && results[selectedIndex]
              ? `search-result-${results[selectedIndex].id}`
              : undefined
          }
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto border border-white/[0.06] bg-muted rounded-sm shadow-md"
        >
          {showSkeleton && (
            <div className="flex flex-col">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 shrink-0 bg-white/[0.08] animate-pulse" />
                    <div className="h-3.5 w-32 bg-white/[0.08] animate-pulse" />
                  </div>
                  <div className="h-3 w-48 bg-white/[0.08] animate-pulse ml-6" />
                </div>
              ))}
            </div>
          )}

          {showEmpty && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No pages match your search
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={result.id}
              id={`search-result-${result.id}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-none ${
                index === selectedIndex
                  ? "bg-white/[0.08]"
                  : "hover:bg-white/[0.04]"
              }`}
              onClick={() => handleNavigate(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {result.icon ? (
                  <span className="shrink-0 text-sm">{result.icon}</span>
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">
                  {result.title || "Untitled"}
                </span>
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground pl-6">
                {renderSnippet(result.snippet)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
