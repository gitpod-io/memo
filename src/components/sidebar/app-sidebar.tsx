"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";
import { PageSearch } from "@/components/sidebar/page-search";
import { PageTree } from "@/components/sidebar/page-tree";
import { UserMenu } from "@/components/sidebar/user-menu";

interface AppSidebarProps {
  userId: string;
  displayName: string;
  email: string;
}

function SidebarContent({
  userId,
  displayName,
  email,
}: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <WorkspaceSwitcher userId={userId} />
      <Separator className="bg-white/[0.06]" />
      <PageSearch />
      <Separator className="bg-white/[0.06]" />
      <PageTree userId={userId} />
      <Separator className="bg-white/[0.06]" />
      <UserMenu displayName={displayName} email={email} />
    </div>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  const { open, setOpen, isMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-60 bg-muted p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="h-full w-60 shrink-0 border-r border-white/[0.06] bg-muted transition-[width,opacity] duration-200 ease-out"
      style={{
        width: open ? 240 : 0,
        opacity: open ? 1 : 0,
        overflow: "hidden",
      }}
    >
      <SidebarContent {...props} />
    </aside>
  );
}

export function SidebarToggle() {
  const { toggle, isMobile } = useSidebar();

  if (!isMobile) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      onClick={toggle}
      aria-label="Toggle sidebar"
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}
