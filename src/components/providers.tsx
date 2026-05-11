"use client";

import { lazy, Suspense } from "react";
import { ThemeProvider } from "@/lib/theme";

// LazyProviders is in a separate file so its chunk-loading manifests
// (TooltipProvider, Toaster) don't inflate the shared framework baseline.
const LazyProviders = lazy(() =>
  import("@/components/lazy-providers").then((mod) => ({
    default: mod.LP,
  })),
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense>
        <LazyProviders>{children}</LazyProviders>
      </Suspense>
    </ThemeProvider>
  );
}
