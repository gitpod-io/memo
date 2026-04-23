"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleSelect } from "@/components/members/role-select";
import type { MemberRole, MemberWithProfile } from "@/lib/types";

interface MemberListProps {
  members: MemberWithProfile[];
  currentUserId: string;
  currentUserRole: MemberRole;
  isPersonalWorkspace: boolean;
  onRoleChange: (memberId: string, newRole: MemberRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

function roleBadgeVariant(role: MemberRole) {
  switch (role) {
    case "owner":
      return "default" as const;
    case "admin":
      return "secondary" as const;
    case "member":
      return "outline" as const;
  }
}

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  isPersonalWorkspace,
  onRoleChange,
  onRemove,
}: MemberListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Track which member's remove dialog is open so we can close it after the
  // async delete completes. AlertDialogAction is a plain Button in Base UI
  // and does not auto-close the dialog.
  const [openDialogMemberId, setOpenDialogMemberId] = useState<string | null>(
    null
  );
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    await onRemove(memberId);
    setOpenDialogMemberId(null);
    setRemovingId(null);
  }

  function canChangeRole(member: MemberWithProfile): boolean {
    if (!isAdmin) return false;
    // Cannot change own role
    if (member.user_id === currentUserId) return false;
    // Only owners can change other owners
    if (member.role === "owner" && currentUserRole !== "owner") return false;
    return true;
  }

  function canRemove(member: MemberWithProfile): boolean {
    if (!isAdmin) return false;
    // Cannot remove yourself via this action (use "leave" instead)
    if (member.user_id === currentUserId) return false;
    // Cannot remove the owner of a personal workspace
    if (isPersonalWorkspace && member.role === "owner") return false;
    // Only owners can remove other owners
    if (member.role === "owner" && currentUserRole !== "owner") return false;
    return true;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs tracking-widest uppercase text-label-faint">
        Members ({members.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            {isAdmin && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {member.profiles.display_name}
                    {member.user_id === currentUserId && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {member.profiles.email}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {canChangeRole(member) ? (
                  <RoleSelect
                    value={member.role}
                    onChange={(role) => onRoleChange(member.id, role)}
                    includeOwner={currentUserRole === "owner"}
                  />
                ) : (
                  <Badge variant={roleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  {canRemove(member) && (
                    <AlertDialog
                      open={openDialogMemberId === member.id}
                      onOpenChange={(open) =>
                        setOpenDialogMemberId(open ? member.id : null)
                      }
                    >
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${member.profiles.display_name}`}
                          />
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove {member.profiles.display_name} from this
                            workspace? They will lose access to all pages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleRemove(member.id)}
                            disabled={removingId === member.id}
                          >
                            {removingId === member.id
                              ? "Removing…"
                              : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
