"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateSlug, isValidSlug } from "@/lib/workspace-utils";
import type { Workspace } from "@/lib/types";

interface WorkspaceSettingsFormProps {
  workspace: Workspace;
}

export function WorkspaceSettingsForm({
  workspace,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameChanged = name.trim() !== workspace.name;
  const slugChanged = slug !== workspace.slug;
  const hasChanges = nameChanged || slugChanged;

  function handleNameChange(value: string) {
    setName(value);
    setSaved(false);
    // Auto-generate slug from name if slug hasn't been manually edited
    if (!slugChanged) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    if (!slug) {
      setError("Slug is required.");
      return;
    }

    if (!isValidSlug(slug)) {
      setError(
        "Slug must be 2–48 characters, lowercase alphanumeric and hyphens only."
      );
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const updates: Record<string, string> = {};
    if (nameChanged) updates.name = trimmedName;
    if (slugChanged) updates.slug = slug;

    const { error: updateError } = await supabase
      .from("workspaces")
      .update(updates)
      .eq("id", workspace.id);

    if (updateError) {
      if (updateError.message.includes("duplicate key")) {
        setError("This slug is already taken. Choose a different one.");
      } else {
        setError(updateError.message);
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);

    // If slug changed, navigate to the new URL
    if (slugChanged) {
      router.push(`/${slug}/settings`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }

    // Navigate to the user's personal workspace
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from("members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.workspaces) {
        const ws = membership.workspaces as unknown as { slug: string };
        router.push(`/${ws.slug}`);
        router.refresh();
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Workspace name"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              setSaved(false);
            }}
            placeholder="workspace-slug"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Used in the URL: /{slug || "…"}
          </p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {saved && (
          <p className="text-xs text-accent">Settings saved.</p>
        )}
        <Button type="submit" disabled={saving || !hasChanges}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {!workspace.is_personal && (
        <div className="space-y-3 border-t border-white/[0.06] pt-8">
          <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground">
            Deleting this workspace will permanently remove all its pages and
            members. This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete workspace
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete workspace</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{workspace.name}&rdquo;
                  and all its pages and members. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  Cancel
                </AlertDialogCancel>
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
      )}

      {workspace.is_personal && (
        <div className="space-y-3 border-t border-white/[0.06] pt-8">
          <p className="text-xs text-muted-foreground">
            This is your personal workspace. It cannot be deleted.
          </p>
        </div>
      )}
    </div>
  );
}
