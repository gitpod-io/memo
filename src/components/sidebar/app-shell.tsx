"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidebarProvider } from "@/components/sidebar/sidebar-context";
import { AppSidebar, SidebarToggle } from "@/components/sidebar/app-sidebar";
import type { Workspace } from "@/lib/types";
import type { ReactNode } from "react";

interface AppShellProps {
  displayName: string;
  email: string;
  userId: string;
  children: ReactNode;
}

export function AppShell({
  displayName,
  email,
  userId,
  children,
}: AppShellProps) {
  const params = useParams<{ workspaceSlug?: string }>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const loadWorkspaces = useCallback(() => {
    const supabase = createClient();
    supabase
      .from("members")
      .select("workspace_id, workspaces(*)")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (data) {
          const ws = data
            .map((m) => m.workspaces as unknown as Workspace)
            .filter(Boolean);
          setWorkspaces(ws);
        }
      });
  }, [userId]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces, params.workspaceSlug]);

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
          workspaces={workspaces}
          currentSlug={params.workspaceSlug}
          userId={userId}
          displayName={displayName}
          email={email}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 md:hidden">
            <SidebarToggle />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
