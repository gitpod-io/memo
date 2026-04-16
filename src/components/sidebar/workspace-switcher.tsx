"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "@/components/sidebar/create-workspace-dialog";
import { WORKSPACE_LIMIT } from "@/lib/workspace";
import type { Workspace } from "@/lib/types";

interface WorkspaceSwitcherProps {
  userId: string;
}

export function WorkspaceSwitcher({ userId }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function fetchWorkspaces() {
      const { data: memberships } = await supabase
        .from("members")
        .select("workspace_id, workspaces(*)")
        .eq("user_id", userId);

      if (memberships) {
        // Supabase join returns the relation as an opaque type; cast is unavoidable
        const ws = memberships
          .map((m) => m.workspaces as unknown as Workspace)
          .filter(Boolean);

        // Personal first, then alphabetically by name
        ws.sort((a, b) => {
          if (a.is_personal && !b.is_personal) return -1;
          if (!a.is_personal && b.is_personal) return 1;
          return a.name.localeCompare(b.name);
        });

        setWorkspaces(ws);
      }
      setLoading(false);
    }

    fetchWorkspaces();
  }, [userId]);

  const currentWorkspace = workspaces.find(
    (w) => w.slug === params.workspaceSlug
  );

  const createdCount = workspaces.filter((w) => w.created_by === userId).length;

  function handleSwitch(slug: string) {
    router.push(`/${slug}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 px-2"
            size="sm"
            aria-label="Switch workspace"
          />
        }
      >
        <span className="truncate text-sm font-medium">
          {loading
            ? "Loading…"
            : currentWorkspace?.name || "Select workspace"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
        <p className="px-1.5 py-1 text-xs tracking-widest uppercase text-white/30">
          Workspaces
        </p>
        {workspaces.map((ws) => (
          <DropdownMenuItem key={ws.id} onClick={() => handleSwitch(ws.slug)}>
            <span className="flex-1 truncate">{ws.name}</span>
            {ws.slug === params.workspaceSlug && (
              <Check className="h-4 w-4 shrink-0 text-accent" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create workspace
          {createdCount >= WORKSPACE_LIMIT && (
            <span className="ml-auto text-xs text-muted-foreground">
              Limit reached
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <CreateWorkspaceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceCount={createdCount}
        userId={userId}
      />
    </DropdownMenu>
  );
}
