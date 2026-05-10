"use client";

import { LazyRouteError } from "@/components/lazy-route-error";

export default function InviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <LazyRouteError
      error={error}
      reset={reset}
      title="Could not load invite"
      description="Something went wrong while loading this invite. The link may be invalid, or there may be a temporary issue."
    >
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: error boundaries use LazyRouteError to avoid pulling next/link into the first-load JS */}
      <a
        href="/sign-in"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to sign in
      </a>
    </LazyRouteError>
  );
}
