"use client";

import { LazyRouteError } from "@/components/lazy-route-error";

export default function ResetPasswordError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LazyRouteError error={error} reset={reset} />;
}
