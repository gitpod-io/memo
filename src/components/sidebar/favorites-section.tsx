"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, StarOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError, isSchemaNotFoundError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import type { FavoriteWithPage } from "@/lib/types";

interface FavoritesSectionProps {
  userId: string;
}

export function FavoritesSection({ userId }: FavoritesSectionProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; pageId?: string }>();
  const [favorites, setFavorites] = useState<FavoriteWithPage[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Increment to trigger re-fetch when other components change favorites
  const [favRefetchKey, setFavRefetchKey] = useState(0);

  const workspaceSlug = params.workspaceSlug;

  // Re-sync when other components change favorites
  useEffect(() => {
    function handleFavoritesChanged() {
      setFavRefetchKey((k) => k + 1);
    }
    window.addEventListener("favorites-changed", handleFavoritesChanged);
    return () => window.removeEventListener("favorites-changed", handleFavoritesChanged);
  }, []);

  // Resolve workspace slug → id (same pattern as page-tree)
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
        captureSupabaseError(error, "favorites:workspace-lookup");
        return;
      }
      if (data) setWorkspaceId(data.id);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  // Fetch favorites for this user + workspace
  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function fetchFavorites() {
      const { data, error } = await retryOnNetworkError(async () => {
        const supabase = await getClient();
        return supabase
          .from("favorites")
          .select("*, pages(id, title, icon)")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
      });

      if (cancelled) return;

      if (error) {
        // Table missing (migration not applied yet) — degrade gracefully
        if (isSchemaNotFoundError(error)) return;
        captureSupabaseError(error, "favorites:fetch");
        return;
      }

      if (data) {
        setFavorites(data as FavoriteWithPage[]);
      }
    }

    fetchFavorites();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, favRefetchKey]);

  const handleRemoveFavorite = useCallback(
    async (favoriteId: string) => {
      // Optimistic removal
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));

      const supabase = await getClient();
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId);

      if (error) {
        if (!isSchemaNotFoundError(error)) {
          captureSupabaseError(error, "favorites:remove");
        }
        toast.error("Failed to remove favorite", { duration: 8000 });
        // Revert — trigger re-fetch
        setFavRefetchKey((k) => k + 1);
      } else {
        window.dispatchEvent(new CustomEvent("favorites-changed"));
      }
    },
    [],
  );

  // Hidden when empty
  if (favorites.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 text-xs tracking-widest uppercase text-white/30">
        Favorites
      </p>
      {favorites.map((fav) => {
        const isSelected = params.pageId === fav.page_id;
        return (
          <div
            key={fav.id}
            className={`group flex items-center gap-2 px-2 py-0.5 text-sm ${
              isSelected
                ? "bg-white/[0.08] font-medium text-white/70"
                : "text-muted-foreground hover:bg-white/[0.04]"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {fav.pages.icon ? (
                <span className="text-sm">{fav.pages.icon}</span>
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </span>

            <button
              className="flex-1 truncate text-left"
              onClick={() =>
                router.push(`/${workspaceSlug}/${fav.page_id}`)
              }
            >
              {fav.pages.title || "Untitled"}
            </button>

            <button
              className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
              onClick={() => handleRemoveFavorite(fav.id)}
              aria-label="Remove from favorites"
            >
              <StarOff className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to check if a page is favorited and toggle the favorite state.
 * Used by page-tree and page-menu dropdowns.
 */
export function useFavorite({
  workspaceId,
  userId,
  pageId,
}: {
  workspaceId: string;
  userId: string;
  pageId: string;
}) {
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkKey, setCheckKey] = useState(0);

  // Re-sync when other components change favorites
  useEffect(() => {
    function handleFavoritesChanged() {
      setCheckKey((k) => k + 1);
    }
    window.addEventListener("favorites-changed", handleFavoritesChanged);
    return () => window.removeEventListener("favorites-changed", handleFavoritesChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from("favorites")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .eq("page_id", pageId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        if (!isSchemaNotFoundError(error)) {
          captureSupabaseError(error, "favorites:check");
        }
      }

      setFavoriteId(data?.id ?? null);
      setLoading(false);
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, pageId, checkKey]);

  const toggle = useCallback(async () => {
    const supabase = await getClient();

    if (favoriteId) {
      // Remove
      setFavoriteId(null);
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId);

      if (error) {
        if (!isSchemaNotFoundError(error)) {
          captureSupabaseError(error, "favorites:toggle-remove");
        }
        toast.error("Failed to remove favorite", { duration: 8000 });
        // Revert
        setFavoriteId(favoriteId);
      } else {
        window.dispatchEvent(new CustomEvent("favorites-changed"));
      }
    } else {
      // Add
      const { data, error } = await supabase
        .from("favorites")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          page_id: pageId,
        })
        .select("id")
        .single();

      if (error) {
        if (!isSchemaNotFoundError(error)) {
          captureSupabaseError(error, "favorites:toggle-add");
        }
        toast.error("Failed to add favorite", { duration: 8000 });
        return;
      }

      if (data) {
        setFavoriteId(data.id);
        window.dispatchEvent(new CustomEvent("favorites-changed"));
      }
    }
  }, [favoriteId, workspaceId, userId, pageId]);

  return {
    isFavorited: favoriteId !== null,
    loading,
    toggle,
  };
}
