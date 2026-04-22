"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError } from "@/lib/sentry";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteAccountSectionProps {
  userEmail: string;
}

export function DeleteAccountSection({ userEmail }: DeleteAccountSectionProps) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [step, setStep] = useState<"idle" | "confirm-email" | "final">("idle");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setStep("idle");
      setEmailInput("");
      setError(null);
    }
  }

  function handleEmailConfirm() {
    if (emailInput.toLowerCase() !== userEmail.toLowerCase()) {
      setError("Email does not match.");
      return;
    }
    setError(null);
    setStep("final");
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });

      // The API may return non-JSON responses (e.g. 405 with empty body),
      // so parse defensively to avoid SyntaxError on empty/malformed bodies.
      let body: { ok?: boolean; error?: string };
      try {
        body = await res.json();
      } catch (_e) {
        body = { error: "Account deletion failed." };
      }

      if (!res.ok) {
        setError(body.error ?? "Account deletion failed.");
        setDeleting(false);
        // Go back to email step on sole-owner conflict so user can cancel
        if (res.status === 409) {
          setStep("confirm-email");
        }
        return;
      }

      // Sign out client-side and redirect
      const supabase = await getClient();
      await supabase.auth.signOut();
      router.push("/sign-in");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Account deletion failed.";
      if (err instanceof Error) {
        captureSupabaseError(err, "delete-account:client");
      }
      setError(message);
      setDeleting(false);
    }
  }

  const emailMatches =
    emailInput.toLowerCase() === userEmail.toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      <p className="text-xs text-muted-foreground">
        Permanently delete your account and all data in your personal workspace.
        Your membership in other workspaces will be removed, but those
        workspaces and their content will remain.
      </p>

      <AlertDialog open={step !== "idle"} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
          onClick={() => setStep("confirm-email")}
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </AlertDialogTrigger>

        {step === "confirm-email" && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account, your personal
                workspace, and all its pages. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-email" className="text-sm">
                Type <span className="font-semibold">{userEmail}</span> to
                confirm
              </Label>
              <Input
                id="confirm-email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={userEmail}
                autoComplete="off"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!emailMatches}
                onClick={(e) => {
                  e.preventDefault();
                  handleEmailConfirm();
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}

        {step === "final" && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This is your last chance. Your account, personal workspace, and
                all pages will be permanently deleted. You will be signed out
                immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
