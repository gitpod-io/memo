import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountPageClient } from "@/components/account-page-client";

export const metadata: Metadata = {
  title: "Account settings",
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name || user.user_metadata?.display_name || "User";
  const email = profile?.email || user.email || "";
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your display name, avatar, and account.
      </p>
      <div className="mt-6">
        <AccountPageClient
          userId={user.id}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
        />
      </div>
    </div>
  );
}
