"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  membersWithWorkspaceSlugPersonal,
  asMemberWorkspaceSlugPersonalRows,
} from "@/lib/supabase/typed-queries";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { Button } from "@/components/ui/button";
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

interface DeleteWorkspaceSectionProps {
  workspaceId: string;
  workspaceName: string;
  userId: string;
}

export function DeleteWorkspaceSection({
  workspaceId,
  workspaceName,
  userId,
}: DeleteWorkspaceSectionProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    const supabase = await getClient();

    const { error: deleteError } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspaceId);

    if (deleteError) {
      if (!isInsufficientPrivilegeError(deleteError)) {
        captureSupabaseError(deleteError, "workspace-settings:delete");
      }
      setError("Failed to delete workspace. Please try again.");
      setDeleting(false);
      return;
    }

    const { data: membership } = await membersWithWorkspaceSlugPersonal(
      supabase,
    )
      .eq("user_id", userId)
      .limit(10);

    const typedRows = asMemberWorkspaceSlugPersonalRows(membership);
    const personal = typedRows.find((m) => m.workspaces?.is_personal);

    if (personal) {
      router.push(`/${personal.workspaces.slug}`);
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      <p className="text-xs text-muted-foreground">
        Deleting this workspace will permanently remove all its pages and
        members. This action cannot be undone.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
        >
          <Trash2 className="h-4 w-4" />
          Delete workspace
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{workspaceName}&rdquo;? All
              pages and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
