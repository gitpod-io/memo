"use client";

import { LazyRouteError } from "@/components/lazy-route-error";

export default function SignUpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LazyRouteError error={error} reset={reset} />;
}
