"use client";

import { useParams, useRouter } from "next/navigation";
import { Keyboard, LogOut, Settings, User, Users } from "lucide-react";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { getClient } from "@/lib/supabase/lazy-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  displayName: string;
  email: string;
}

export function UserMenu({ displayName, email }: UserMenuProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const { setShortcutsOpen } = useSidebar();

  async function handleSignOut() {
    const supabase = await getClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  function handleSettings() {
    if (params.workspaceSlug) {
      router.push(`/${params.workspaceSlug}/settings`);
    }
  }

  function handleMembers() {
    if (params.workspaceSlug) {
      router.push(`/${params.workspaceSlug}/settings/members`);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2"
            size="sm"
          />
        }
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={4}>
        <div className="px-1.5 py-1">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSettings}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMembers}>
          <Users className="h-4 w-4" />
          Members
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
          <Keyboard className="h-4 w-4" />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
