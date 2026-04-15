"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "@/components/sidebar/create-workspace-dialog";
import type { Workspace } from "@/lib/types";
import { MAX_CREATED_WORKSPACES } from "@/lib/workspace-utils";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentSlug: string | undefined;
  userId: string;
}

/** Sort workspaces: personal first, then alphabetically by name. */
function sortWorkspaces(workspaces: Workspace[]): Workspace[] {
  return [...workspaces].sort((a, b) => {
    if (a.is_personal && !b.is_personal) return -1;
    if (!a.is_personal && b.is_personal) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function WorkspaceSwitcher({
  workspaces,
  currentSlug,
  userId,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = sortWorkspaces(workspaces);
  const current = sorted.find((w) => w.slug === currentSlug);
  const createdCount = workspaces.filter((w) => w.created_by === userId).length;
  const canCreate = createdCount < MAX_CREATED_WORKSPACES;

  return (
    <>
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
            {current?.name || "Workspace"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
          {sorted.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => router.push(`/${ws.slug}`)}
            >
              <Check
                className={`h-4 w-4 ${ws.slug === currentSlug ? "opacity-100" : "opacity-0"}`}
              />
              <span className="truncate">{ws.name}</span>
              {ws.is_personal && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Personal
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {current && !current.is_personal && (
            <>
              <DropdownMenuItem
                onClick={() => router.push(`/${current.slug}/settings`)}
              >
                <Settings className="h-4 w-4" />
                Workspace settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            disabled={!canCreate}
            onClick={() => {
              if (canCreate) setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {canCreate
              ? "Create workspace"
              : `Limit reached (${MAX_CREATED_WORKSPACES} max)`}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        userId={userId}
      />
    </>
  );
}
