"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InviteRole, WorkspaceInviteWithInviter } from "@/lib/types";

interface InviteFormProps {
  workspaceId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  onInviteSent: (invite: WorkspaceInviteWithInviter) => void;
  onError: (error: string) => void;
}

const INVITE_EXPIRY_DAYS = 7;

export function InviteForm({
  workspaceId,
  currentUserId,
  currentUserDisplayName,
  onInviteSent,
  onError,
}: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access denied — button stays in default state
    }
  }, [inviteLink]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteLink(null);
    setLinkCopied(false);
    onError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setSending(true);

    const supabase = createClient();

    // Check if user is already a member.
    // Disambiguate: members has two FKs to profiles (user_id, invited_by).
    const { data: existingMember } = await supabase
      .from("members")
      .select("id, profiles!members_user_id_fkey(email)")
      .eq("workspace_id", workspaceId);

    const alreadyMember = existingMember?.some((m) => {
      const profile = m.profiles as unknown as { email: string } | null;
      return profile?.email?.toLowerCase() === trimmedEmail;
    });

    if (alreadyMember) {
      onError("This user is already a member of this workspace.");
      setSending(false);
      return;
    }

    // Remove any existing pending invite so re-inviting is idempotent.
    // This covers the case where a previous revoke failed silently (e.g.
    // RLS-blocked deletes return success with 0 rows) or the user simply
    // wants to refresh the invite expiry.
    const { data: existingInvite } = await supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", trimmedEmail)
      .is("accepted_at", null)
      .maybeSingle();

    if (existingInvite) {
      const { error: deleteError } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("id", existingInvite.id);

      if (deleteError) {
        onError("Failed to replace existing invite. Try revoking it first.");
        setSending(false);
        return;
      }
    }

    // Generate token and expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const { data: newInvite, error: insertError } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email: trimmedEmail,
        role,
        invited_by: currentUserId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError || !newInvite) {
      onError(insertError?.message ?? "Failed to create invite.");
      setSending(false);
      return;
    }

    const link = `${window.location.origin}/invite/${token}`;
    setSending(false);
    setInviteLink(link);
    setEmail("");
    setRole("member");
    onInviteSent({
      ...newInvite,
      profiles: { display_name: currentUserDisplayName },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-white/30">
        Invite
      </p>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setInviteLink(null);
            }}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            value={role}
            onValueChange={(val) => setRole(val as InviteRole)}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={sending}>
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : "Invite"}
        </Button>
      </form>
      {inviteLink && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-accent">
            {inviteLink}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyLink}
            aria-label="Copy invite link"
          >
            {linkCopied ? (
              <Check className="h-4 w-4 text-accent" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
