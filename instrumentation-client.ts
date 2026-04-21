// Sentry is loaded via dynamic import() to keep it out of the shared
// framework chunk. This reduces first-load JS by ~130kB gzipped.
// The import executes immediately so the SDK initializes before the
// first user interaction in practice.
let captureTransition: ((url: string, type: string) => void) | null = null;

import("@sentry/nextjs").then(async (Sentry) => {
  // Dynamic import keeps sentry.ts out of the shared framework chunk.
  // The filter functions only inspect the event object — they have no
  // Sentry runtime dependency.
  const { isNextjsInternalNoise, isReactLexicalDomConflict } = await import(
    "@/lib/sentry"
  );

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    sendDefaultPii: true,

    // 100% in dev, 10% in production
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    // Session Replay: 10% of all sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    enableLogs: true,

    integrations: [Sentry.replayIntegration()],

    beforeSend(event) {
      if (isNextjsInternalNoise(event)) return null;
      if (isReactLexicalDomConflict(event)) return null;
      return event;
    },
  });

  captureTransition = Sentry.captureRouterTransitionStart;
});

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  captureTransition?.(url, navigationType);
}
