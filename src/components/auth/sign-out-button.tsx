"use client";

import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/lazy-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = await getClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
