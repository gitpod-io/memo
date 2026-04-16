"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateSlug, WORKSPACE_LIMIT } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceCount: number;
  userId: string;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  workspaceCount,
  userId,
}: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const atLimit = workspaceCount >= WORKSPACE_LIMIT;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atLimit || !name.trim()) return;

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const slug = generateSlug(name.trim());

    const { data: workspace, error: createError } = await supabase
      .from("workspaces")
      .insert({
        name: name.trim(),
        slug,
        is_personal: false,
        created_by: userId,
      })
      .select("id, slug")
      .single();

    if (createError) {
      if (createError.message.includes("Workspace limit reached")) {
        setError(`You can create at most ${WORKSPACE_LIMIT} workspaces.`);
      } else {
        setError(createError.message);
      }
      setLoading(false);
      return;
    }

    // Add the creator as owner
    const { error: memberError } = await supabase.from("members").insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: "owner",
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    onOpenChange(false);
    setName("");
    setLoading(false);
    router.push(`/${workspace.slug}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            {atLimit
              ? `You've reached the limit of ${WORKSPACE_LIMIT} workspaces.`
              : "A workspace is a shared space for your team's pages."}
          </DialogDescription>
        </DialogHeader>
        {atLimit ? (
          <p className="text-xs text-muted-foreground">
            Delete an existing workspace to create a new one.
          </p>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={60}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
