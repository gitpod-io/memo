import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Supabase may return the joined workspace as an object or array — normalise to a slug. */
function extractSlug(
  workspaces: { slug: string } | { slug: string }[] | null | undefined,
): string | undefined {
  if (Array.isArray(workspaces)) return workspaces[0]?.slug;
  return workspaces?.slug;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Redirect authenticated users to their personal workspace.
    // Use !inner join so the is_personal filter excludes non-matching rows.
    const { data: personalMembership } = await supabase
      .from("members")
      .select("workspace_id, workspaces!inner(slug)")
      .eq("user_id", user.id)
      .eq("workspaces.is_personal", true)
      .limit(1)
      .maybeSingle();

    const personalSlug = extractSlug(personalMembership?.workspaces);
    if (personalSlug) {
      redirect(`/${personalSlug}`);
    }

    // Fall back to any workspace if no personal workspace exists
    const { data: anyMembership } = await supabase
      .from("members")
      .select("workspace_id, workspaces(slug)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const anySlug = extractSlug(anyMembership?.workspaces);
    if (anySlug) {
      redirect(`/${anySlug}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Memo</h1>
        <p className="text-sm text-muted-foreground">
          A Notion-style workspace, built with zero human code.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://github.com/gitpod-io/memo"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Source
          </a>
          <Link
            href="/sign-in"
            className="inline-flex items-center px-4 py-2 border border-overlay-border text-sm font-medium hover:bg-muted"
          >
            Sign In
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-8">
          Every line of code in this repository is written by AI agents.
        </p>
      </div>
    </main>
  );
}
