"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
import { isValidSlug } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import type { Workspace } from "@/lib/types";

interface WorkspaceSettingsFormProps {
  workspace: Workspace;
  userId: string;
}

export function WorkspaceSettingsForm({
  workspace,
  userId,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isOwner = workspace.created_by === userId;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!isValidSlug(slug)) {
      setError(
        "Slug must be 3–60 characters, lowercase alphanumeric and hyphens only."
      );
      return;
    }

    setSaving(true);

    const supabase = await getClient();
    const slugChanged = slug !== workspace.slug;

    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), slug })
      .eq("id", workspace.id);

    if (updateError) {
      if (updateError.message.includes("duplicate key")) {
        setError("This slug is already taken. Choose a different one.");
      } else {
        captureSupabaseError(updateError, "workspace-settings:update");
        setError("Failed to save settings. Please try again.");
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccess(true);

    if (slugChanged) {
      router.push(`/${slug}/settings`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = await getClient();

    const { error: deleteError } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);

    if (deleteError) {
      captureSupabaseError(deleteError, "workspace-settings:delete");
      setError("Failed to delete workspace. Please try again.");
      setDeleting(false);
      return;
    }

    // Redirect to the user's personal workspace
    const { data: membership } = await supabase
      .from("members")
      .select("workspace_id, workspaces(slug, is_personal)")
      .eq("user_id", userId)
      .limit(10);

    // Supabase join returns the relation as an opaque type; casts are unavoidable
    const personal = membership?.find((m) => {
      const ws = m.workspaces as unknown as { slug: string; is_personal: boolean };
      return ws?.is_personal;
    });

    if (personal) {
      const ws = personal.workspaces as unknown as { slug: string };
      router.push(`/${ws.slug}`);
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            required
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            Used in the URL: /{slug}
          </p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && (
          <p className="text-xs text-accent">Settings saved.</p>
        )}
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {!workspace.is_personal && isOwner && (
        <>
          <Separator className="bg-overlay-border" />
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-destructive">
              Danger zone
            </h2>
            <p className="text-xs text-muted-foreground">
              Deleting this workspace will permanently remove all its pages and
              members. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm" />
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete workspace
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{workspace.name}
                    &rdquo;? All pages and members will be permanently removed.
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
        </>
      )}

      {workspace.is_personal && (
        <>
          <Separator className="bg-overlay-border" />
          <p className="text-xs text-muted-foreground">
            This is your personal workspace. It will be deleted if you delete
            your account.
          </p>
        </>
      )}
    </div>
  );
}
