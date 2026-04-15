import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/sidebar/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name || user.user_metadata?.display_name || "User";
  const email = profile?.email || user.email || "";

  return (
    <AppShell displayName={displayName} email={email} userId={user.id}>
      {children}
    </AppShell>
  );
}
