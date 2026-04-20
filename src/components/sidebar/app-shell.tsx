"use client";

import dynamic from "next/dynamic";
import { SidebarProvider } from "@/components/sidebar/sidebar-context";
import type { ReactNode } from "react";

const AppSidebar = dynamic(
  () =>
    import("@/components/sidebar/app-sidebar").then((mod) => mod.AppSidebar),
);

const SidebarToggle = dynamic(
  () =>
    import("@/components/sidebar/app-sidebar").then((mod) => mod.SidebarToggle),
);

interface AppShellProps {
  userId: string;
  displayName: string;
  email: string;
  children: ReactNode;
}

export function AppShell({
  userId,
  displayName,
  email,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
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
