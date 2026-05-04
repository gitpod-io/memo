"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
import { isValidSlug } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Workspace } from "@/lib/types";

const DeleteWorkspaceSection = dynamic(
  () =>
    import("@/components/delete-workspace-section").then(
      (mod) => mod.DeleteWorkspaceSection,
    ),
);

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
          <DeleteWorkspaceSection
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            userId={userId}
          />
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
