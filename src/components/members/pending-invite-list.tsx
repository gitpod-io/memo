"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkspaceInviteWithInviter } from "@/lib/types";

interface PendingInviteListProps {
  invites: WorkspaceInviteWithInviter[];
  onRevoke: (inviteId: string) => Promise<void>;
}

export function PendingInviteList({
  invites,
  onRevoke,
}: PendingInviteListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(inviteId: string) {
    setRevokingId(inviteId);
    await onRevoke(inviteId);
    setRevokingId(null);
  }

  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-white/30">
        Pending invites ({invites.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell>
                <span className="text-sm">{invite.email}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{invite.role}</Badge>
              </TableCell>
              <TableCell>
                {isExpired(invite.expires_at) ? (
                  <span className="text-xs text-destructive">Expired</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Expires{" "}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokingId === invite.id}
                  aria-label={`Revoke invite for ${invite.email}`}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
