import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteAccept } from "@/components/members/invite-accept";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Look up the invite by token
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("*, workspaces(name, slug)")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Invalid invite
          </CardTitle>
          <CardDescription>
            This invite link is invalid or has been revoked.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invite.accepted_at) {
    // Supabase join returns the relation as an opaque type; cast is unavoidable
    const ws = invite.workspaces as unknown as { name: string; slug: string };
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Already accepted
          </CardTitle>
          <CardDescription>
            This invite to {ws?.name} has already been accepted.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Invite expired
          </CardTitle>
          <CardDescription>
            This invite has expired. Ask the workspace admin to send a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Supabase join returns the relation as an opaque type; cast is unavoidable
  const ws = invite.workspaces as unknown as { name: string; slug: string };

  // Check if the current user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Join {ws?.name}
        </CardTitle>
        <CardDescription>
          You&apos;ve been invited to join as {invite.role === "admin" ? "an" : "a"}{" "}
          <span className="font-medium text-foreground">{invite.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteAccept
          token={token}
          inviteId={invite.id}
          workspaceId={invite.workspace_id}
          workspaceSlug={ws?.slug ?? ""}
          email={invite.email}
          role={invite.role}
          isAuthenticated={!!user}
          userEmail={user?.email ?? null}
        />
      </CardContent>
    </Card>
  );
}
