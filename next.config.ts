import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Bundle splitting strategy: see docs/bundle-budget.md for the full chunk
// inventory and guidelines. Key points:
// - Framework baseline is ~152 kB gzipped (Next.js + React + shared providers)
// - Heavy deps (Sentry, Supabase, Lexical) are lazy-loaded via dynamic import
// - Per-route budget: 200 kB gzipped, enforced by `pnpm test:bundle`
// - Framework baseline budget: 160 kB gzipped, checked by the same script

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.preview.devx.network", "*.preview.env.ona.dev"],
  experimental: {
    // Cache dynamic route RSC payloads for 30s on the client.
    // Makes back/forward navigation instant instead of re-fetching.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  // Disable client-side route manifest injection. The manifest adds ~800 bytes
  // to the shared framework chunk. Sentry still captures route names via the
  // server-side instrumentation; client transactions will use raw URLs instead
  // of parameterized paths, which is acceptable for our traffic volume.
  routeManifestInjection: false,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
