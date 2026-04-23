"use client";

import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "@/lib/theme";

const TooltipProvider = dynamic(
  () =>
    import("@/components/ui/tooltip").then((mod) => mod.TooltipProvider),
);

const Toaster = dynamic(() =>
  import("sonner").then((mod) => mod.Toaster),
);

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        className: "rounded-sm font-mono text-sm",
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
