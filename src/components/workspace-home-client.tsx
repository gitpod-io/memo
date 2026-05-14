"use client";

import dynamic from "next/dynamic";
import type { RecentPageVisit } from "@/lib/types";

const WorkspaceHome = dynamic(
  () =>
    import("@/components/workspace-home").then((mod) => mod.WorkspaceHome),
);

interface WorkspaceHomeClientProps {
  workspace: { id: string; name: string; slug: string };
  pages: {
    id: string;
    title: string;
    icon: string | null;
    is_database: boolean;
    created_at: string;
    updated_at: string;
    child_count: number;
  }[];
  userId: string;
  recentVisits?: RecentPageVisit[];
}

export function WorkspaceHomeClient(props: WorkspaceHomeClientProps) {
  return <WorkspaceHome {...props} />;
}
