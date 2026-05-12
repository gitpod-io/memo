"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WorkspaceInviteWithInviter } from "@/lib/types";

interface PendingInviteListProps {
  invites: WorkspaceInviteWithInviter[];
  onRevoke: (inviteId: string) => Promise<void>;
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — no-op
    }
  }, [token]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            aria-label="Copy invite link"
          />
        }
      >
        {copied ? (
          <Check className="h-4 w-4 text-accent" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : "Copy invite link"}</TooltipContent>
    </Tooltip>
  );
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
    <div className="flex flex-col gap-3" data-testid="pending-invite-list">
      <p className="text-xs tracking-widest uppercase text-label-faint">
        Pending invites ({invites.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id} data-testid={`pending-invite-row-${invite.id}`}>
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
                <div className="flex items-center gap-1">
                  <CopyLinkButton token={invite.token} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRevoke(invite.id)}
                    disabled={revokingId === invite.id}
                    aria-label={`Revoke invite for ${invite.email}`}
                    data-testid={`pending-invite-revoke-btn-${invite.id}`}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
