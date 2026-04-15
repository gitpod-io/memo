"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function SignUpPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // After sign-up, the handle_new_user trigger creates a personal workspace.
    // Fetch it so we can redirect there.
    if (data.user) {
      const { data: membership } = await supabase
        .from("members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.workspaces) {
        const ws = membership.workspaces as unknown as { slug: string };
        router.push(`/${ws.slug}`);
        return;
      }
    }

    // Fallback: redirect to root
    router.push("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Create an account</CardTitle>
        <CardDescription>
          Enter your details to get started with Memo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              type="text"
              placeholder="Jane Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              autoFocus
            />
          </div>
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
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.06]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <OAuthButtons />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
