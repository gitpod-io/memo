"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountSettingsFormProps {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

export function AccountSettingsForm({
  userId,
  displayName: initialDisplayName,
  email,
  avatarUrl: initialAvatarUrl,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (2 MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Avatar must be under 2 MB.");
        return;
      }

      // Validate file type
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setError("Avatar must be PNG, JPEG, or WebP.");
        return;
      }

      setUploading(true);
      setError(null);
      setSuccess(false);

      const supabase = await getClient();
      const ext = file.name.split(".").pop() ?? "png";
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        if (
          !isSchemaNotFoundError(uploadError) &&
          !isInsufficientPrivilegeError(uploadError)
        ) {
          captureSupabaseError(uploadError, "account:avatar-upload");
        }
        setError("Failed to upload avatar. Please try again.");
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Append cache-buster so the browser fetches the new image
      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: freshUrl })
        .eq("id", userId);

      if (updateError) {
        if (
          !isSchemaNotFoundError(updateError) &&
          !isInsufficientPrivilegeError(updateError)
        ) {
          captureSupabaseError(updateError, "account:avatar-url-update");
        }
        setError("Avatar uploaded but failed to save. Please try again.");
        setUploading(false);
        return;
      }

      setAvatarUrl(freshUrl);
      setUploading(false);
      router.refresh();

      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [userId, router],
  );

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Display name is required.");
      return;
    }

    if (trimmed.length > 100) {
      setError("Display name must be 100 characters or fewer.");
      return;
    }

    setSaving(true);

    const supabase = await getClient();

    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);

    if (profileError) {
      if (
        !isSchemaNotFoundError(profileError) &&
        !isInsufficientPrivilegeError(profileError)
      ) {
        captureSupabaseError(profileError, "account:display-name-update");
      }
      setError("Failed to save display name. Please try again.");
      setSaving(false);
      return;
    }

    // Sync to auth.users.user_metadata so it stays consistent
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });

    if (authError) {
      if (
        !isSchemaNotFoundError(authError) &&
        !isInsufficientPrivilegeError(authError)
      ) {
        captureSupabaseError(authError, "account:auth-metadata-update");
      }
      // Non-fatal: profile is already updated, metadata sync failed
    }

    setSaving(false);
    setSuccess(true);
    setDisplayName(trimmed);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar section */}
      <div className="flex flex-col gap-3">
        <Label>Avatar</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Change avatar"
            data-testid="avatar-upload-button"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-muted-foreground">
                {getInitials(displayName)}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAvatarClick}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Change avatar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP. Max 2 MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
            aria-hidden="true"
            data-testid="avatar-file-input"
          />
        </div>
      </div>

      {/* Display name form */}
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-display-name">Display name</Label>
          <Input
            id="account-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={100}
            data-testid="account-display-name-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-email">Email</Label>
          <Input
            id="account-email"
            value={email}
            disabled
            className="text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed.
          </p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && (
          <p className="text-xs text-accent">Settings saved.</p>
        )}
        <div>
          <Button type="submit" disabled={saving} data-testid="account-save-button">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
