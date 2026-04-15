"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidebarProvider } from "@/components/sidebar/sidebar-context";
import { AppSidebar, SidebarToggle } from "@/components/sidebar/app-sidebar";
import type { ReactNode } from "react";

interface AppShellProps {
  displayName: string;
  email: string;
  children: ReactNode;
}

export function AppShell({ displayName, email, children }: AppShellProps) {
  const params = useParams<{ workspaceSlug?: string }>();
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    if (!params.workspaceSlug) return;

    const supabase = createClient();
    supabase
      .from("workspaces")
      .select("name")
      .eq("slug", params.workspaceSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setWorkspaceName(data.name);
      });
  }, [params.workspaceSlug]);

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
          workspaceName={workspaceName || "Workspace"}
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
