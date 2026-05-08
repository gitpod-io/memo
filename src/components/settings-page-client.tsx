"use client";

import dynamic from "next/dynamic";
import type { Workspace } from "@/lib/types";

const SettingsPageContent = dynamic(
  () =>
    import("@/components/settings-page-content").then(
      (mod) => mod.SettingsPageContent,
    ),
);

interface SettingsPageClientProps {
  workspace: Workspace;
  userId: string;
  userEmail: string;
}

export function SettingsPageClient(props: SettingsPageClientProps) {
  return <SettingsPageContent {...props} />;
}
