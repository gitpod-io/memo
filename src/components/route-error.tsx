"use client";

import { lazyCaptureException } from "@/lib/capture";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    lazyCaptureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-medium">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred. You can try again, and the rest of the
          app should still work.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
