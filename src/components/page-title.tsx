"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PageTitleProps {
  pageId: string;
  initialTitle: string;
}

/**
 * Inline-editable page title. Parent should use `key={pageId}` to reset
 * state when navigating between pages.
 */
export function PageTitle({ pageId, initialTitle }: PageTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef(initialTitle);

  // Focus the title field when the page is new (empty title)
  useEffect(() => {
    if (!initialTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialTitle]);

  const saveTitle = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed === lastSavedRef.current) return;

      const supabase = createClient();
      const { error } = await supabase
        .from("pages")
        .update({ title: trimmed })
        .eq("id", pageId);

      if (!error) {
        lastSavedRef.current = trimmed;
      }
    },
    [pageId]
  );

  function handleBlur() {
    saveTitle(title);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(title);
      inputRef.current?.blur();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Untitled"
      className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground outline-none"
      aria-label="Page title"
    />
  );
}
