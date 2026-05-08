"use client";

import { useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/lazy-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = await getClient();
    const siteUrl =
      typeof window !== "undefined" ? window.location.origin : "";

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      });

    if (resetError) {
      import("@/lib/sentry").then(({ captureSupabaseError }) =>
        captureSupabaseError(resetError, "forgot-password:resetPasswordForEmail"),
      );
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Check your inbox
          </CardTitle>
          <CardDescription>
            We sent a password reset link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click the link to set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button
              type="button"
              className="text-accent underline-offset-4 hover:underline"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              try again
            </button>
            .
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/sign-in"
              className="text-accent underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Reset your password
        </CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Remember your password?{" "}
          <Link
            href="/sign-in"
            className="text-accent underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
