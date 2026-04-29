"use client";

import dynamic from "next/dynamic";

const DemoEditor = dynamic(
  () =>
    import("@/components/editor/demo-editor").then((mod) => mod.DemoEditor),
  { ssr: false },
);

/**
 * Client wrapper for the landing page demo editor. Lazy-loads the Lexical
 * editor to avoid SSR issues with browser-only APIs (sessionStorage, DOM).
 */
export function LandingDemoEditor() {
  return (
    <div
      className="w-full max-w-3xl border border-overlay-border bg-background p-6"
      data-testid="landing-demo-editor-wrapper"
    >
      <DemoEditor />
    </div>
  );
}
