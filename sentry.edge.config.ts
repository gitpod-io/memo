import * as Sentry from "@sentry/nextjs";
import { isNextjsInternalNoise } from "@/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  beforeSend(event) {
    if (isNextjsInternalNoise(event)) {
      return null;
    }
    return event;
  },
});
