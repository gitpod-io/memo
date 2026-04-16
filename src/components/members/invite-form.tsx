"use client";

import { useState } from "react";
import { Send } from "lucide-react";
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
import type { InviteRole } from "@/lib/types";

interface InviteFormProps {
  workspaceId: string;
  currentUserId: string;
  onInviteSent: () => void;
  onError: (error: string) => void;
}

const INVITE_EXPIRY_DAYS = 7;

export function InviteForm({
  workspaceId,
  currentUserId,
  onInviteSent,
  onError,
}: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess(false);
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

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", trimmedEmail)
      .is("accepted_at", null)
      .maybeSingle();

    if (existingInvite) {
      onError("An invite has already been sent to this email.");
      setSending(false);
      return;
    }

    // Generate token and expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const { error: insertError } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email: trimmedEmail,
        role,
        invited_by: currentUserId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      onError(insertError.message);
      setSending(false);
      return;
    }

    setSending(false);
    setSuccess(true);
    setEmail("");
    setRole("member");
    onInviteSent();
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
              setSuccess(false);
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
      {success && (
        <p className="text-xs text-accent">Invite sent.</p>
      )}
    </div>
  );
}
