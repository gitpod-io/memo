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

  // Look up the invite by token via security definer function.
  // Works for both anon and authenticated users.
  const { data: invites } = await supabase.rpc("get_invite_by_token", {
    invite_token: token,
  });

  const invite = invites?.[0] ?? null;

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
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Already accepted
          </CardTitle>
          <CardDescription>
            This invite to {invite.workspace_name} has already been accepted.
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

  // Check if the current user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Join {invite.workspace_name}
        </CardTitle>
        <CardDescription>
          You&apos;ve been invited to join as {invite.role === "admin" ? "an" : "a"}{" "}
          <span className="font-medium text-foreground">{invite.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteAccept
          inviteId={invite.id}
          workspaceSlug={invite.workspace_slug ?? ""}
          email={invite.email}
          isAuthenticated={!!user}
          userEmail={user?.email ?? null}
        />
      </CardContent>
    </Card>
  );
}
