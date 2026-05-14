import * as Sentry from "@sentry/nextjs";
import { shouldDropServerEvent } from "@/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  includeLocalVariables: true,

  enableLogs: true,

  beforeSend(event) {
    return shouldDropServerEvent(event) ? null : event;
  },
});
