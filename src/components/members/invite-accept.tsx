"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/supabase/lazy-client";
import { Button } from "@/components/ui/button";

interface InviteAcceptProps {
  inviteId: string;
  workspaceSlug: string;
  email: string;
  isAuthenticated: boolean;
  userEmail: string | null;
}

export function InviteAccept({
  inviteId,
  workspaceSlug,
  email,
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

    const supabase = await getClient();

    // Use the security definer RPC which atomically marks the invite as
    // accepted and inserts the member with the correct role from the invite.
    const { error: acceptError } = await supabase.rpc("accept_invite", {
      invite_id: inviteId,
    });

    if (acceptError) {
      // Duplicate key means already a member — treat as success
      if (acceptError.message.includes("duplicate key")) {
        router.push(`/${workspaceSlug}`);
        return;
      }
      setError(acceptError.message);
      setAccepting(false);
      return;
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
