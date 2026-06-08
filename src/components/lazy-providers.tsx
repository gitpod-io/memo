"use client";

import { lazy, Suspense } from "react";
import { ThemeProvider, useTheme } from "@/lib/theme";

// Lazy-load TooltipProvider and Toaster. This file is a separate chunk from
// the root Providers so the chunk-loading manifests for these dependencies
// don't inflate the shared framework baseline. ThemeProvider is also here
// because its only consumers (useTheme) are in lazy-loaded components.
const TooltipProvider = lazy(() =>
  import("@/components/ui/tooltip").then((mod) => ({
    default: mod.TooltipProvider,
  })),
);

const Toaster = lazy(() =>
  import("sonner").then((mod) => ({ default: mod.Toaster })),
);

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Suspense>
      <Toaster
        theme={resolved}
        position="bottom-right"
        toastOptions={{
          className: "rounded-sm font-mono text-sm",
        }}
      />
    </Suspense>
  );
}

export function LazyProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense>
        <TooltipProvider>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </Suspense>
    </ThemeProvider>
  );
}
