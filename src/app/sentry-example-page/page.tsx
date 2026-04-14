"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [status, setStatus] = useState<string>("");

  function throwClientError() {
    throw new Error("Sentry client test error — delete me");
  }

  async function captureManualError() {
    Sentry.captureException(new Error("Sentry manual capture test — delete me"));
    setStatus("Sent to Sentry. Check your Issues dashboard.");
  }

  async function triggerServerError() {
    setStatus("Calling API...");
    const res = await fetch("/api/sentry-example-api");
    const data = await res.json();
    setStatus(`Server responded: ${JSON.stringify(data)}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Sentry Test Page</h1>
      <p className="text-zinc-500">Use these buttons to verify Sentry is capturing errors.</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={throwClientError}
          className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Throw Client Error
        </button>
        <button
          onClick={captureManualError}
          className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
        >
          Capture Manual Error
        </button>
        <button
          onClick={triggerServerError}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Trigger Server Error
        </button>
      </div>
      {status && (
        <p className="text-sm text-zinc-400 mt-4">{status}</p>
      )}
    </div>
  );
}
