"use client";

import dynamic from "next/dynamic";

const TooltipProvider = dynamic(
  () =>
    import("@/components/ui/tooltip").then((mod) => mod.TooltipProvider),
);

const Toaster = dynamic(() =>
  import("sonner").then((mod) => mod.Toaster),
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          className: "rounded-sm font-mono text-sm",
        }}
      />
    </TooltipProvider>
  );
}
