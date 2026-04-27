"use client";

import { useState } from "react";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = await getClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      captureSupabaseError(updateError, "change-password:updateUser");
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>
      <p className="text-xs text-muted-foreground">
        Update your account password. You&apos;ll stay signed in after changing
        it.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && (
          <p className="text-xs text-accent">Password updated.</p>
        )}
        <div>
          <Button type="submit" disabled={loading} size="sm">
            {loading ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
