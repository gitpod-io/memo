"use client";

import dynamic from "next/dynamic";

const DeleteAccountSection = dynamic(
  () =>
    import("@/components/delete-account-section").then(
      (mod) => mod.DeleteAccountSection,
    ),
);

interface DangerZoneSettingsProps {
  userEmail: string;
}

export function DangerZoneSettings({ userEmail }: DangerZoneSettingsProps) {
  return <DeleteAccountSection userEmail={userEmail} />;
}
