"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-loaded wrapper around RouteError. Error boundaries are registered
 * eagerly by Next.js for every route segment, so a static import of
 * RouteError (which pulls in lucide-react AlertCircle + Button) adds
 * ~7 kB gzip to every page's first-load JS. Dynamic import defers that
 * cost until an error actually occurs.
 */
const RouteError = dynamic(
  () => import("@/components/route-error").then((mod) => mod.RouteError),
);

export function LazyRouteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return <RouteError {...props} />;
}
