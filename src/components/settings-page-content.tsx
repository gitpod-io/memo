"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { Separator } from "@/components/ui/separator";
import type { Workspace } from "@/lib/types";

const ChangePasswordSection = dynamic(
  () =>
    import("@/components/change-password-section").then(
      (mod) => mod.ChangePasswordSection,
    ),
);

const DangerZoneSettings = dynamic(
  () =>
    import("@/components/danger-zone-settings").then(
      (mod) => mod.DangerZoneSettings,
    ),
);

interface SettingsPageContentProps {
  workspace: Workspace;
  userId: string;
  userEmail: string;
}

export function SettingsPageContent({
  workspace,
  userId,
  userEmail,
}: SettingsPageContentProps) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <Link
          href={`/${workspace.slug}/settings/members`}
          className="text-sm text-accent underline underline-offset-4"
        >
          Members
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace name, URL, and other settings.
      </p>
      <div className="mt-6">
        <WorkspaceSettingsForm workspace={workspace} userId={userId} />
      </div>
      {workspace.is_personal && (
        <>
          <Separator className="mt-8 bg-overlay-border" />
          <div className="mt-8">
            <ChangePasswordSection />
          </div>
          <Separator className="mt-8 bg-overlay-border" />
          <div className="mt-8">
            <DangerZoneSettings userEmail={userEmail} />
          </div>
        </>
      )}
    </div>
  );
}
