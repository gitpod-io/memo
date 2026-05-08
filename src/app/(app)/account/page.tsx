import type { Metadata } from "next";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";

const AccountSettingsForm = dynamic(
  () =>
    import("@/components/account-settings-form").then(
      (mod) => mod.AccountSettingsForm,
    ),
);

const ChangePasswordSection = dynamic(
  () =>
    import("@/components/change-password-section").then(
      (mod) => mod.ChangePasswordSection,
    ),
);

const DeleteAccountSection = dynamic(
  () =>
    import("@/components/delete-account-section").then(
      (mod) => mod.DeleteAccountSection,
    ),
);

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
        <AccountSettingsForm
          userId={user.id}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
        />
      </div>
      <Separator className="mt-8 bg-overlay-border" />
      <div className="mt-8">
        <ChangePasswordSection />
      </div>
      <Separator className="mt-8 bg-overlay-border" />
      <div className="mt-8">
        <DeleteAccountSection userEmail={email} />
      </div>
    </div>
  );
}
