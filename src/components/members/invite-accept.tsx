"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { InviteRole } from "@/lib/types";

interface InviteAcceptProps {
  token: string;
  inviteId: string;
  workspaceId: string;
  workspaceSlug: string;
  email: string;
  role: InviteRole;
  isAuthenticated: boolean;
  userEmail: string | null;
}

export function InviteAccept({
  inviteId,
  workspaceId,
  workspaceSlug,
  email,
  role,
  isAuthenticated,
  userEmail,
}: InviteAcceptProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not authenticated — prompt to sign in or sign up
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Sign in or create an account with{" "}
          <span className="font-medium text-foreground">{email}</span> to
          accept this invite.
        </p>
        <div className="flex gap-2">
          <Button render={<Link href="/sign-in" />}>Sign in</Button>
          <Button variant="outline" render={<Link href="/sign-up" />}>
            Sign up
          </Button>
        </div>
      </div>
    );
  }

  // Authenticated but with a different email
  const emailMismatch =
    userEmail && userEmail.toLowerCase() !== email.toLowerCase();

  if (emailMismatch) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          This invite was sent to{" "}
          <span className="font-medium text-foreground">{email}</span>, but
          you&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{userEmail}</span>.
        </p>
        <p className="text-sm text-muted-foreground">
          Sign in with the invited email to accept.
        </p>
      </div>
    );
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to accept this invite.");
      setAccepting(false);
      return;
    }

    // Insert the member row
    const { error: memberError } = await supabase.from("members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role,
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      // If already a member, treat as success
      if (memberError.message.includes("duplicate key")) {
        // Mark invite as accepted anyway
        await supabase
          .from("workspace_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", inviteId);

        router.push(`/${workspaceSlug}`);
        return;
      }
      setError(memberError.message);
      setAccepting(false);
      return;
    }

    // Mark the invite as accepted
    const { error: acceptError } = await supabase
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (acceptError) {
      // Member was already created, so redirect anyway
      console.error("Failed to mark invite as accepted:", acceptError.message);
    }

    router.push(`/${workspaceSlug}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{userEmail}</span>.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handleAccept} disabled={accepting}>
        {accepting ? "Joining…" : "Accept invite"}
      </Button>
    </div>
  );
}
