"use client";

import { lazy, Suspense } from "react";

// LazyProviders is in a separate file so its chunk-loading manifests
// (ThemeProvider, TooltipProvider, Toaster) don't inflate the shared
// framework baseline. The inline theme script in layout.tsx handles
// the visual theme before React hydrates, so deferring ThemeProvider
// to the lazy chunk does not cause a flash of wrong theme.
const LazyProviders = lazy(() =>
  import("@/components/lazy-providers").then((mod) => ({
    default: mod.LazyProviders,
  })),
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <LazyProviders>{children}</LazyProviders>
    </Suspense>
  );
}
