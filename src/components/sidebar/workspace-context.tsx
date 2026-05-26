"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";

interface WorkspaceContextValue {
  /** Resolved workspace UUID, or null while loading / if slug is absent. */
  workspaceId: string | null;
  /** The slug from the URL params. */
  workspaceSlug: string | undefined;
  /** True once the slug→ID resolution has completed (even if it failed). */
  resolved: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceSlug?: string }>();
  const workspaceSlug = params.workspaceSlug;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!workspaceSlug) {
      queueMicrotask(() => {
        setWorkspaceId(null);
        setResolved(true);
      });
      return;
    }

    queueMicrotask(() => setResolved(false));
    let cancelled = false;

    retryOnNetworkError(async () => {
      const supabase = await getClient();
      return supabase
        .from("workspaces")
        .select("id")
        .eq("slug", workspaceSlug)
        .maybeSingle();
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (
            !isSchemaNotFoundError(error) &&
            !isInsufficientPrivilegeError(error)
          ) {
            captureSupabaseError(error, "workspace-context:lookup");
          }
          setResolved(true);
          return;
        }
        setWorkspaceId(data?.id ?? null);
        setResolved(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        captureSupabaseError(
          error instanceof Error ? error : new Error(String(error)),
          "workspace-context:resolve",
        );
        setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, workspaceSlug, resolved }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
