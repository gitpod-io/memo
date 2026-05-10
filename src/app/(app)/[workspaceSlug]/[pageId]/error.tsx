"use client";

import { LazyRouteError } from "@/components/lazy-route-error";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <LazyRouteError error={error} reset={reset} />;
}
