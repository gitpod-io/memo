"use client";

import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Inline dynamic import instead of importing lazyCaptureException from
    // @/lib/capture — avoids pulling the capture module into the shared
    // framework chunk where global-error is always included.
    import("@sentry/nextjs").then(({ captureException }) => {
      captureException(error);
    });
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
