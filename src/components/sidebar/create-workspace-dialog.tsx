"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { generateSlug } from "@/lib/workspace-utils";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  userId,
}: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setName("");
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }

    const slug = generateSlug(trimmed);
    if (!slug) {
      setError("Name must contain at least one alphanumeric character.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Append a random suffix to ensure slug uniqueness
    const uniqueSlug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

    const { data, error: insertError } = await supabase
      .from("workspaces")
      .insert({
        name: trimmed,
        slug: uniqueSlug,
        is_personal: false,
        created_by: userId,
      })
      .select("id, slug")
      .single();

    if (insertError) {
      // DB trigger returns P0001 when limit is reached
      if (insertError.message.includes("Workspace limit reached")) {
        setError("You can create at most 3 workspaces.");
      } else if (insertError.message.includes("duplicate key")) {
        setError("A workspace with this slug already exists. Try a different name.");
      } else {
        setError(insertError.message);
      }
      setLoading(false);
      return;
    }

    // Create owner membership for the new workspace
    await supabase.from("members").insert({
      workspace_id: data.id,
      user_id: userId,
      role: "owner",
      joined_at: new Date().toISOString(),
    });

    setLoading(false);
    handleClose();
    router.push(`/${data.slug}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Add a new workspace to organize your pages.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="My Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
            {name.trim() && (
              <p className="text-xs text-muted-foreground">
                Slug: {generateSlug(name.trim()) || "—"}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
