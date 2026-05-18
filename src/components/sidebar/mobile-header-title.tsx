"use client";

import { useEffect, useState } from "react";

/**
 * Observes document.title changes (set by generateMetadata on each page)
 * and displays the current page title in the mobile header.
 */
export function MobileHeaderTitle() {
  const [title, setTitle] = useState("");

  useEffect(() => {
    function extractTitle() {
      const raw = document.title;
      // Strip the " | Memo" or " — Memo" suffix if present
      const cleaned = raw.replace(/\s*[|—–-]\s*Memo$/i, "").trim();
      setTitle(cleaned || "");
    }

    // Set initial title
    extractTitle();

    // Observe changes to the <title> element's text content.
    // Next.js updates <title> on client-side navigation via generateMetadata.
    const titleElement = document.querySelector("title");
    if (!titleElement) return;

    const observer = new MutationObserver(extractTitle);
    observer.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  if (!title) return null;

  return (
    <span
      className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
      data-testid="mobile-header-title"
    >
      {title}
    </span>
  );
}
