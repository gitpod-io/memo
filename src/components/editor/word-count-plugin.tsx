"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { $isCodeNode } from "@lexical/code";
import { getWordCount, formatWordCountDisplay } from "@/lib/word-count";

const DEBOUNCE_MS = 500;

/**
 * Extract visible text from the editor state, excluding code blocks.
 * Walks the root's children and collects text content from non-code nodes.
 */
function $getVisibleTextContent(): string {
  const root = $getRoot();
  const parts: string[] = [];

  for (const child of root.getChildren()) {
    if ($isCodeNode(child)) continue;
    parts.push(child.getTextContent());
  }

  return parts.join(" ");
}

export function WordCountPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    // Compute initial word count from the current editor state
    editor.getEditorState().read(() => {
      const text = $getVisibleTextContent();
      setWordCount(getWordCount(text));
    });

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (timerId) clearTimeout(timerId);

      timerId = setTimeout(() => {
        editorState.read(() => {
          const text = $getVisibleTextContent();
          setWordCount(getWordCount(text));
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      unregister();
    };
  }, [editor]);

  return (
    <div className="mt-8 text-xs text-muted-foreground">
      {formatWordCountDisplay(wordCount)}
    </div>
  );
}
