import Link from "next/link";
import { FileText, ArrowUpLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface PageBacklinksProps {
  pageId: string;
  workspaceId: string;
  workspaceSlug: string;
}

interface BacklinkRow {
  source_page_id: string;
  pages: {
    id: string;
    title: string;
    icon: string | null;
  };
}

export async function PageBacklinks({
  pageId,
  workspaceId,
  workspaceSlug,
}: PageBacklinksProps) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("page_links")
    .select("source_page_id, pages!page_links_source_page_id_fkey(id, title, icon)")
    .eq("target_page_id", pageId)
    .eq("workspace_id", workspaceId);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Supabase returns joined data; narrow the type
  const backlinks = data as unknown as BacklinkRow[];

  return (
    <div className="mt-8 border-t border-white/[0.06] pt-4">
      <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-white/30 mb-3">
        <ArrowUpLeft className="h-3.5 w-3.5" />
        Backlinks
      </div>
      <div className="flex flex-col gap-1">
        {backlinks.map((backlink) => (
          <Link
            key={backlink.source_page_id}
            href={`/${workspaceSlug}/${backlink.pages.id}`}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-none"
          >
            {backlink.pages.icon ? (
              <span className="shrink-0 text-sm">{backlink.pages.icon}</span>
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">
              {backlink.pages.title || "Untitled"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
