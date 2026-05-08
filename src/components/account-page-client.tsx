"use client";

import { lazy, Suspense } from "react";
import { AccountSettingsForm } from "@/components/account-settings-form";

const ChangePasswordSection = lazy(() =>
  import("@/components/change-password-section").then((mod) => ({
    default: mod.ChangePasswordSection,
  })),
);

const DeleteAccountSection = lazy(() =>
  import("@/components/delete-account-section").then((mod) => ({
    default: mod.DeleteAccountSection,
  })),
);

function SectionSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-4 w-32 bg-muted" />
      <div className="h-3 w-64 bg-muted" />
      <div className="h-9 w-full bg-muted" />
    </div>
  );
}

interface AccountPageClientProps {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export function AccountPageClient({
  userId,
  displayName,
  email,
  avatarUrl,
}: AccountPageClientProps) {
  return (
    <div className="flex flex-col gap-6">
      <AccountSettingsForm
        userId={userId}
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
      />
      <div className="h-px w-full bg-overlay-border" />
      <Suspense fallback={<SectionSkeleton />}>
        <ChangePasswordSection />
      </Suspense>
      <div className="h-px w-full bg-overlay-border" />
      <Suspense fallback={<SectionSkeleton />}>
        <DeleteAccountSection userEmail={email} />
      </Suspense>
    </div>
  );
}
