"use client";

import Link from "next/link";
import { RouteError } from "@/components/route-error";

export default function InviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Could not load invite"
      description="Something went wrong while loading this invite. The link may be invalid, or there may be a temporary issue."
    >
      <Link
        href="/sign-in"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to sign in
      </Link>
    </RouteError>
  );
}
